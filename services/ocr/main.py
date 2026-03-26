from __future__ import annotations

import io
import json
import os
import re
import time
import logging
from datetime import datetime
import importlib.util
from typing import Any, Dict, List, Optional, Tuple

import cv2
import httpx
import numpy as np
import pytesseract
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile, Request
from fastapi.responses import JSONResponse
from paddleocr import PaddleOCR
from PIL import Image

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="SGDigital OCR Service", version="0.1.0")


def _get_by_path(obj: Any, path: str) -> Optional[Any]:
    cur = obj
    for part in (path or "").split("."):
        p = part.strip()
        if not p:
            continue
        if not isinstance(cur, dict):
            return None
        cur = cur.get(p)
    return cur


def _find_snippet(text: str, value: str, window: int = 80) -> Optional[str]:
    if not text or not value:
        return None
    t = text
    # Búsqueda case-insensitive en el texto original
    try:
        idx = t.lower().find(value.lower())
        if idx >= 0:
            start = max(0, idx - window)
            end = min(len(t), idx + len(value) + window)
            return t[start:end].replace("\n", " ").strip()
    except Exception:
        pass

    # Fallback por normalización (puede perder offsets exactos)
    t_norm = normalize_text_for_match(t)
    v_norm = normalize_text_for_match(value)
    if v_norm and v_norm in t_norm:
        # no tenemos offset exacto sobre t, devolvemos el valor como evidencia mínima
        return value.strip()
    return None


def build_evidence_snippets(extracted_text: str, structured: Dict[str, Any]) -> Dict[str, str]:
    snippets: Dict[str, str] = {}
    for path in (
        "vendor.nit",
        "vendor.name",
        "customer.nit",
        "customer.name",
        "invoice.number",
        "invoice.date",
        "invoice.dueDate",
        "invoice.cufe",
        "dian.cufe",
        "dian.resolutionNumber",
        "monetary.subtotal",
        "monetary.taxTotal",
        "monetary.withholdingTotal",
        "monetary.total",
        "payment.method",
    ):
        v = _get_by_path(structured, path)
        if v is None:
            continue
        s = _find_snippet(extracted_text, str(v))
        if s:
            snippets[path] = s
    return snippets


def _tokenize_for_match(value: str) -> List[str]:
    # Mantener tokens alfanuméricos para buscar en words
    v = normalize_text_for_match(value)
    return [t for t in re.findall(r"[a-z0-9]+", v) if t]


def build_highlights_from_tesseract(page_results: List[Dict[str, Any]], structured: Dict[str, Any]) -> Dict[str, Any]:
    """Retorna highlights por campo usando bboxes de Tesseract.

    Solo es fiable para previews basados en imagen (mismas coordenadas píxel).
    """
    targets: Dict[str, str] = {}
    for path in (
        "vendor.nit",
        "customer.nit",
        "invoice.number",
        "invoice.date",
        "invoice.dueDate",
        "invoice.cufe",
        "dian.cufe",
        "monetary.subtotal",
        "monetary.taxTotal",
        "monetary.withholdingTotal",
        "monetary.total",
    ):
        v = _get_by_path(structured, path)
        if v is None:
            continue
        vs = str(v).strip()
        if vs:
            targets[path] = vs

    highlights: Dict[str, Any] = {}
    if not targets:
        return highlights

    for field_path, value in targets.items():
        needle_tokens = _tokenize_for_match(value)
        if not needle_tokens:
            continue

        for page_index, page in enumerate(page_results or []):
            tess = (page or {}).get("tesseract") or {}
            words = tess.get("words") if isinstance(tess, dict) else None
            if not isinstance(words, list) or not words:
                continue

            word_tokens: List[str] = []
            word_boxes: List[Dict[str, Any]] = []
            for w in words:
                if not isinstance(w, dict):
                    continue
                txt = normalize_text_for_match(str(w.get("text") or ""))
                if not txt:
                    continue
                tok = re.findall(r"[a-z0-9]+", txt)
                if not tok:
                    continue
                # Usamos el primer token por palabra
                word_tokens.append(tok[0])
                word_boxes.append(w)

            if len(word_tokens) < len(needle_tokens):
                continue

            # Buscar subsecuencia
            found_idx = -1
            for i in range(0, len(word_tokens) - len(needle_tokens) + 1):
                if word_tokens[i:i + len(needle_tokens)] == needle_tokens:
                    found_idx = i
                    break

            if found_idx >= 0:
                boxes: List[Dict[str, float]] = []
                for j in range(found_idx, found_idx + len(needle_tokens)):
                    bbox = (word_boxes[j] or {}).get("bbox")
                    if isinstance(bbox, dict):
                        try:
                            boxes.append({
                                "x": float(bbox.get("x", 0)),
                                "y": float(bbox.get("y", 0)),
                                "w": float(bbox.get("w", 0)),
                                "h": float(bbox.get("h", 0)),
                            })
                        except Exception:
                            pass

                highlights[field_path] = {
                    "pageIndex": int(page_index),
                    "pageWidth": int((page or {}).get("width") or 0),
                    "pageHeight": int((page or {}).get("height") or 0),
                    "boxes": boxes,
                }
                break

    return highlights


def detect_document_type_co(text: str) -> Tuple[str, float, List[str]]:
    """Clasificador heurístico (CO/DIAN).

    Retorna (tipo, confianza 0..1, evidencias).
    """
    t = normalize_text_for_match(text or "")
    evidences: List[str] = []

    def has(needle: str) -> bool:
        return needle in t

    # Nota: orden importante (nota crédito suele contener 'factura' también).
    if has("nota credito") or has("nota cr") or has("credit note"):
        evidences.append("nota credito")
        return "NOTA_CREDITO", 0.9, evidences

    # Confirmaciones de pago (emails/recibos): "tu pago ... ha sido recibido"
    if (has("pago") and has("recibido")) or has("payment received") or has("pago recibido"):
        evidences.append("pago recibido")
        return "PAGO", 0.75, evidences

    if has("recibo") and (has("caja") or has("pago") or has("abono")):
        evidences.append("recibo")
        return "RECIBO", 0.75, evidences

    if has("comprobante de egreso") or has("egreso"):
        evidences.append("comprobante de egreso")
        return "PAGO", 0.7, evidences

    if has("factura electronica") or has("factura electronica de venta") or has("dian"):
        evidences.append("factura electronica")
        return "FACTURA", 0.85, evidences

    if has("cotizacion") or has("cotizaci"):
        evidences.append("cotizacion")
        return "COTIZACION", 0.7, evidences

    # Fallback
    return "DESCONOCIDO", 0.3, evidences


def heuristic_extract_structured_co_invoice(extracted_text: str) -> Dict[str, Any]:
    """Extractor heurístico (sin LLM) para facturas CO.

    No pretende cubrir todos los layouts; sirve como fallback robusto.
    """
    text = extracted_text or ""
    text_norm = normalize_text_for_match(text)

    vendor_name = None
    nit = None
    invoice_number = None

    def _label_value(label_regex: str, max_chars: int = 180) -> Optional[str]:
        """Extrae un valor en la misma línea después de una etiqueta."""
        if not text:
            return None
        mmm = re.search(label_regex + r"\s*[:#-]?\s*([^\n\r]{2," + str(max_chars) + r"})", text, flags=re.IGNORECASE)
        if not mmm:
            return None
        v = mmm.group(1).strip()
        v = re.sub(r"\s{2,}", " ", v)
        v = re.sub(r"\s*(?:\.|,|;|:)\s*$", "", v)
        return v or None

    def _digits_only(s: str) -> str:
        return re.sub(r"\D", "", s or "")

    def _format_qty(q: float) -> str:
        if q is None:
            return ""
        # Cantidades usualmente no requieren 2 decimales; pero aceptamos fracción.
        if abs(q - round(q)) <= 1e-9:
            return str(int(round(q)))
        return f"{q:.3f}".rstrip("0").rstrip(".")

    def _extract_items_from_text(raw_text: str) -> Tuple[List[Dict[str, Any]], Optional[float]]:
        """Extrae ítems de una sección tipo tabla y retorna (items, subtotal_from_items)."""
        if not raw_text:
            return [], None

        lines = [ln.strip() for ln in raw_text.splitlines() if ln and ln.strip()]
        if not lines:
            return [], None

        # Encontrar inicio de sección de productos/ítems.
        start_idx = -1
        for i, ln in enumerate(lines):
            ln_norm = normalize_text_for_match(ln)
            if "detalles de productos" in ln_norm or "detalle de productos" in ln_norm or "detalle de productos" in ln_norm:
                start_idx = i
                break

        # Si no hay encabezado explícito, buscar un header de tabla típico.
        if start_idx < 0:
            for i, ln in enumerate(lines):
                ln_norm = normalize_text_for_match(ln)
                if (
                    ("descripcion" in ln_norm and ("cantidad" in ln_norm or "cant" in ln_norm) and ("precio" in ln_norm or "unitario" in ln_norm))
                    or (
                        ("precio unitario" in ln_norm or "precio" in ln_norm)
                        and ("venta" in ln_norm or "unitario" in ln_norm)
                        and ("cantidad" in ln_norm or "cant" in ln_norm)
                    )
                ):
                    start_idx = i
                    break

        # Helper local: detectar tokens monetarios sin confundir cantidades (ej: 45) como dinero.
        number_pat = re.compile(r"\b(\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d{1,3})?|\d+(?:[\.,]\d{1,3})?)\b")

        def _money_tokens(line: str) -> List[Tuple[int, float]]:
            tokens: List[Tuple[int, float]] = []
            if not line:
                return tokens
            for nm in number_pat.finditer(line):
                tok = (nm.group(1) or "").strip()
                val = parse_decimal_co(tok)
                if val is None:
                    continue

                # En tablas de ítems, un monto usualmente tiene separador (5.000,00 / 45,00)
                # o es un entero grande (>= 1000). Evita confundir cantidades pequeñas.
                has_sep = ("," in tok) or ("." in tok)
                if (not has_sep) and float(val) < 1000.0:
                    continue

                tokens.append((nm.start(), float(val)))
            return tokens

        # Fallback: si no hay header, buscar la primera línea que parezca fila de ítem.
        if start_idx < 0:
            for i, ln in enumerate(lines):
                ln_norm = normalize_text_for_match(ln)
                if any(m in ln_norm for m in ("subtotal", "totales", "total", "resumen", "observaciones")):
                    continue

                monies = _money_tokens(ln)
                if len(monies) < 2:
                    continue

                # Debe existir algo de texto no numérico.
                if len(re.sub(r"[^A-Za-zÁÉÍÓÚÑáéíóúñ]", "", ln)) < 6:
                    continue

                start_idx = i
                break

        if start_idx < 0:
            return [], None

        # Avanzar hasta pasar posibles headers de tabla.
        i = start_idx + 1
        while i < len(lines):
            ln_norm = normalize_text_for_match(lines[i])
            if ("descripcion" in ln_norm and "cantidad" in ln_norm) or ln_norm.startswith("no") or ln_norm.startswith("codigo"):
                i += 1
                continue
            # Primera línea de datos probable
            break

        end_markers = (
            "notas finales",
            "totales",
            "total",
            "subtotal",
            "resumen",
            "observaciones",
        )

        items: List[Dict[str, Any]] = []
        subtotal_from_items: float = 0.0
        money_pat_local = re.compile(money_pat, flags=re.IGNORECASE)

        for j in range(i, len(lines)):
            ln = lines[j]
            ln_norm = normalize_text_for_match(ln)
            if any(m in ln_norm for m in end_markers) and len(ln_norm) < 40:
                break

            # Saltar headers repetidos
            if ("descripcion" in ln_norm and "cantidad" in ln_norm) or ("precio" in ln_norm and "unitario" in ln_norm):
                continue

            # Preferir extracción por tokens para no capturar cantidades pequeñas como dinero.
            # (Ej: una línea que inicia con "45" cantidad; el regex global de money también lo capturaría.)
            monies: List[Tuple[int, float]] = _money_tokens(ln)

            if not monies:
                continue

            monies.sort(key=lambda x: x[0])
            first_money_pos = monies[0][0]
            prefix = ln[:first_money_pos].strip()
            if not prefix:
                continue

            # qty: último número antes del primer monto
            qty_val: Optional[float] = None
            qty_token = None
            qty_pos = -1
            qty_end = -1
            for nm in number_pat.finditer(prefix):
                qty_token = nm.group(1)
                qty_pos = nm.start()
                qty_end = nm.end()
            if qty_token:
                qty_val = parse_decimal_co(qty_token)

            # Elegir amount/unitPrice de forma más global:
            # - amount: mayor monto positivo
            # - unitPrice: menor monto positivo (ignorando ceros y valores demasiado cercanos al total)
            vals = [v for _, v in monies]
            pos_vals = [v for v in vals if v is not None and v > 0.0001]
            if not pos_vals:
                continue

            amount_val = max(pos_vals)
            unit_price_val: Optional[float] = None
            if len(pos_vals) >= 2:
                unit_candidates = [v for v in pos_vals if abs(v - amount_val) > 0.009]
                if unit_candidates:
                    # Si tenemos qty, preferir el candidato que sea consistente con amount.
                    if qty_val is not None and qty_val > 0:
                        unit_est = amount_val / float(qty_val)
                        best = min(unit_candidates, key=lambda v: abs(v - unit_est))
                        rel_err = abs(best - unit_est) / max(abs(unit_est), 1.0)
                        if rel_err <= 0.15:
                            unit_price_val = best
                        else:
                            unit_price_val = min(unit_candidates)
                    else:
                        unit_price_val = min(unit_candidates)

            # description: robusto a layouts donde la cantidad está al inicio.
            # - Si qty está al inicio: descripción está después de qty
            # - Si qty está al final: descripción está antes de qty
            desc_part = prefix
            if qty_pos >= 0:
                if qty_pos == 0 and qty_end > 0:
                    desc_part = prefix[qty_end:].strip()
                else:
                    desc_part = prefix[:qty_pos].strip()

            # Eliminar columnas comunes al inicio: No. y Código
            desc_part = re.sub(r"^\s*\d+\s+\S+\s+", "", desc_part)

            # Eliminar U/M al final (solo si parece una unidad real)
            toks = [t for t in desc_part.split() if t]
            if toks:
                last = toks[-1]
                last_norm = normalize_text_for_match(last)
                known_units = {
                    "un",
                    "und",
                    "unidad",
                    "unidades",
                    "kg",
                    "g",
                    "gr",
                    "lb",
                    "l",
                    "lt",
                    "ml",
                    "m",
                    "cm",
                    "mm",
                    "m2",
                    "m3",
                    "hr",
                    "hrs",
                    "hora",
                    "horas",
                    "dia",
                    "dias",
                    "mes",
                    "meses",
                    "serv",
                    "servicio",
                    "servicios",
                }
                if last_norm in known_units:
                    toks = toks[:-1]
            description = " ".join(toks).strip()
            if not description:
                continue

            # Filtrar falsos positivos: líneas con solo código/encabezados
            if len(description) < 3:
                continue

            items.append(
                {
                    "description": description,
                    "qty": _format_qty(qty_val) if qty_val is not None else None,
                    "unitPrice": f"{unit_price_val:.2f}" if unit_price_val is not None else None,
                    "amount": f"{amount_val:.2f}" if amount_val is not None else None,
                }
            )

            if amount_val is not None and amount_val > 0:
                subtotal_from_items += amount_val

        if not items:
            return [], None
        return items, subtotal_from_items if subtotal_from_items > 0 else None

    # Encabezado común (DIAN/email): NIT;NOMBRE;FE48975;...
    m_hdr = re.search(r"\b(\d{6,11})\s*;\s*([^;\n\r]{3,120}?)\s*;\s*([A-Z]{1,6}\d{3,})\b", text)
    if m_hdr:
        nit = m_hdr.group(1).strip()
        vendor_name = m_hdr.group(2).strip()
        invoice_number = m_hdr.group(3).strip().upper()

    # Vendor NIT: soportar 'NIT: 901152321' y variantes con dígito de verificación
    if not nit:
        m = re.search(r"\bnit\s*[:#-]?\s*([0-9][0-9\.\s]{5,14}(?:\s*[-–]\s*\d)?)\b", text, flags=re.IGNORECASE)
        if m:
            raw = m.group(1)
            raw = raw.replace("–", "-")
            raw = re.sub(r"\s+", "", raw)
            raw = raw.replace(".", "")
            nit = raw

    # Layouts tipo DIAN/PDF: "Nit del Emisor:" / "NIT del Emisor:"
    if not nit:
        v = _label_value(r"nit\s+del\s+emisor")
        if v:
            digits = _digits_only(v)
            if len(digits) >= 6:
                nit = digits
    if not nit:
        m = re.search(r"\b\d{6,11}\s*[-–]\s*\d\b", text)
        if m:
            nit = m.group(0).strip().replace("–", "-")

    # Nombre del proveedor/emisor: 'Factura electrónica por X'
    if not vendor_name:
        m = re.search(r"factura\s+electr[oó]nica\s+por\s+([^\n\r]{3,140})", text, flags=re.IGNORECASE)
        if m:
            vendor_name = m.group(1).strip()
            vendor_name = re.sub(r"\s{2,}", " ", vendor_name)
            vendor_name = re.sub(r"\s*(?:\.|,|;|:)\s*$", "", vendor_name)

    # Layouts tipo factura PDF: "Razón Social:" / "Nombre Comercial:"
    if not vendor_name:
        v = _label_value(r"raz[oó]n\s+social") or _label_value(r"razon\s+social")
        if v:
            vendor_name = v
    if not vendor_name:
        v = _label_value(r"nombre\s+comercial")
        if v:
            vendor_name = v

    # Número de factura (evitar capturar 'electronica'). Requerimos al menos 1 dígito.
    if not invoice_number:
        patterns = [
            r"numero\s+de\s+factura\s*[:#-]?\s*([A-Z0-9\-]*\d[A-Z0-9\-]{2,})",
            r"factura\s*(?:#|no\.?|n\.?|nro\.?|número|num\.?|n°)\s*[:#-]?\s*([A-Z0-9\-]*\d[A-Z0-9\-]{2,})",
        ]
        for pat in patterns:
            mm = re.search(pat, text_norm, flags=re.IGNORECASE)
            if mm:
                invoice_number = mm.group(1).strip().upper()
                break

    # Layouts tipo factura PDF: "Número de Factura:" con formatos 0001-36, etc.
    if not invoice_number:
        v = _label_value(r"n[uú]mero\s+de\s+factura") or _label_value(r"numero\s+de\s+factura")
        if v:
            mm = re.search(r"([A-Z0-9\-]{3,})", v.strip(), flags=re.IGNORECASE)
            if mm:
                invoice_number = mm.group(1).strip().upper()

    # Fecha: priorizar la "Fecha de expedición/emisión" del documento (no la fecha/hora del correo).
    invoice_date = None
    date_raw = None

    # 1) ISO yyyy-mm-dd cerca de la etiqueta
    mm = re.search(
        r"fecha\s+de\s+(?:emision|emisión|expedicion|expedición)\b.{0,120}?(\d{4}-\d{1,2}-\d{1,2})",
        text_norm,
        flags=re.IGNORECASE,
    )
    if mm:
        date_raw = mm.group(1)

    # 2) dd/mm/aaaa o dd/mm/aa cerca de la etiqueta
    if not date_raw:
        mm = re.search(
            r"fecha\s+de\s+(?:emision|emisión|expedicion|expedición)\b.{0,120}?(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
            text_norm,
            flags=re.IGNORECASE,
        )
        date_raw = mm.group(1) if mm else None

    # 3) Mes en español cerca de la etiqueta
    if not date_raw:
        mm = re.search(
            r"fecha\s+de\s+(?:emision|emisión|expedicion|expedición)\b.{0,120}?(\d{1,2}\s+de\s+[a-záéíóúñ]+\s+de\s+\d{4})\b",
            text_norm,
            flags=re.IGNORECASE,
        )
        date_raw = mm.group(1) if mm else None

    # Fallbacks generales (menos confiables): pueden capturar la fecha del correo.
    if not date_raw:
        mm = re.search(r"\b(\d{4}-\d{1,2}-\d{1,2})\b", text)
        date_raw = mm.group(1) if mm else None
    if not date_raw:
        mm = re.search(r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b", text)
        date_raw = mm.group(1) if mm else None
    if not date_raw:
        mm = re.search(r"\b(\d{1,2}\s+de\s+[a-záéíóúñ]+\s+de\s+\d{4})\b", text_norm)
        date_raw = mm.group(1) if mm else None
    if date_raw:
        dt = parse_date_co(date_raw)
        if dt:
            invoice_date = dt.isoformat()

    # Vencimiento
    due_date = None
    mm = re.search(r"fecha\s+de\s+vencimiento\s*[:#-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})", text_norm)
    due_raw = mm.group(1) if mm else None
    if not due_raw:
        mm = re.search(r"fecha\s+de\s+vencimiento\s*[:#-]?\s*(\d{1,2}\s+de\s+[a-záéíóúñ]+\s+de\s+\d{4})", text_norm)
        due_raw = mm.group(1) if mm else None
    if due_raw:
        dt = parse_date_co(due_raw)
        if dt:
            due_date = dt.isoformat()

    # CUFE (típicamente alfanumérico largo)
    cufe = None
    mm = re.search(r"cufe\s*[:#-]?\s*([a-z0-9]{20,})", text_norm)
    if mm:
        cufe = mm.group(1).strip()

    money_pat = r"(?:\$|cop|usd|eur)?\s*\$?\s*(\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d{2})?|\d+(?:[\.,]\d{2})?)\s*(?:cop|usd|eur)?"

    def _best_money_in_fragment(fragment: str) -> Optional[float]:
        candidates: List[Tuple[int, int, float]] = []
        frag = fragment or ""
        for m in re.finditer(money_pat, frag, flags=re.IGNORECASE):
            raw_num = (m.group(1) or "").strip()
            parsed = parse_decimal_co(raw_num)
            if parsed is None:
                continue

            match_str = (m.group(0) or "")
            match_lower = match_str.lower()
            has_currency = ("$" in match_str) or ("cop" in match_lower) or ("usd" in match_lower) or ("eur" in match_lower)
            has_sep = ("," in raw_num) or ("." in raw_num)
            digits_only = re.sub(r"\D", "", raw_num)

            # Evitar IDs largos sin moneda/separadores (ej: NIT 1026559275 en tablas tipo email/DIAN).
            if len(digits_only) >= 7 and (not has_currency) and (not has_sep):
                continue

            score = 0
            if has_currency:
                score += 3
            if has_sep:
                score += 2
            if parsed >= 1000:
                score += 1

            candidates.append((score, int(m.start()), float(parsed)))

        if not candidates:
            return None

        # Elegir el mejor puntaje; en empate, preferir el más cercano al final.
        candidates.sort(key=lambda x: (x[0], x[1]))
        return candidates[-1][2]

    # Subtotal / IVA / Retenciones (heurístico por etiqueta)
    def _money_after_label(label_pat: str) -> Optional[float]:
        # Capturar un fragmento después de la etiqueta y elegir el mejor monto.
        mmm = re.search(label_pat + r"\b(.{0,140})", text_norm, flags=re.IGNORECASE)
        if not mmm:
            return None
        fragment = mmm.group(1)

        best = _best_money_in_fragment(fragment)
        if best is not None:
            return best
        return None

    def _money_candidates_with_separators(raw_text: str) -> List[float]:
        # Captura montos estilo "145,930" / "1.234.567" / "145,930.00" / "$145,930"
        vals: List[float] = []
        for m in re.finditer(r"(?:\$\s*)?(\d{1,3}(?:[\.,]\d{3})+(?:[\.,]\d{2})?|\d{1,3}(?:[\.,]\d{3})+)", raw_text):
            parsed = parse_decimal_co(m.group(1))
            if parsed is not None:
                vals.append(parsed)
        return vals

    subtotal_val = _money_after_label(r"subtotal")
    iva_val = _money_after_label(r"iva")
    wh_val = (
        _money_after_label(r"retefuente")
        or _money_after_label(r"reteiva")
        or _money_after_label(r"reteica")
        or _money_after_label(r"retencion")
    )

    # Total: priorizar etiquetas comunes antes que "el mayor número".
    total_val = (
        _money_after_label(r"valor\s+total")
        or _money_after_label(r"total\s+a\s+pagar")
        or _money_after_label(r"total")
    )

    # Fallback adicional: montos con separadores suelen ser los totales reales en PDFs resumen.
    if total_val is None:
        sep_vals = [v for v in _money_candidates_with_separators(text) if v >= 1000]
        if sep_vals:
            total_val = max(sep_vals)

    # Fallback: escoger el mayor monto candidato razonable
    if total_val is None:
        candidates: List[float] = []
        for m in re.finditer(r"\b(\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d{2})?)\b", text):
            parsed = parse_decimal_co(m.group(1))
            if parsed is not None:
                candidates.append(parsed)
        if candidates:
            candidates2 = [v for v in candidates if v >= 1000]
            total_val = max(candidates2) if candidates2 else max(candidates)

    # Cliente (cuando viene en resumen tipo email/DIAN)
    customer_name = None

    # 1) Saludo (suele ser el mejor candidato)
    m = re.search(r"\b¡?hola,\s*([^!\n\r]{2,80})", text, flags=re.IGNORECASE)
    if m:
        customer_name = re.sub(r"\s{2,}", " ", m.group(1).strip())

    # 2) Encabezado/fila: "A nombre de ..." (evitar capturar el encabezado de columnas)
    if not customer_name:
        m = re.search(r"a\s+nombre\s+de\s+([^\n\r]{2,80})", text, flags=re.IGNORECASE)
        if m:
            cand = re.sub(r"\s{2,}", " ", m.group(1).strip())
            if not re.search(r"\bnit\b|\bcliente\b|\bfecha\b|\bvalor\b", cand, flags=re.IGNORECASE):
                customer_name = cand

    # 3) Si el texto trae encabezado de tabla y la fila con datos en la siguiente línea
    if not customer_name:
        m = re.search(
            r"a\s+nombre\s+de\b[^\n\r]{0,200}[\n\r]+\s*([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+){0,3})\s+\d{6,}",
            text,
            flags=re.IGNORECASE,
        )
        if m:
            customer_name = re.sub(r"\s{2,}", " ", m.group(1).strip())

    customer_nit = None
    m = re.search(r"nit\s+cliente\b.{0,30}?([0-9][0-9\.\s]{6,14})", text, flags=re.IGNORECASE)
    if m:
        customer_nit = re.sub(r"\D", "", m.group(1))

    # Layouts tipo factura PDF: Datos del Adquiriente/Comprador
    if not customer_name:
        v = _label_value(r"nombre\s+o\s+raz[oó]n\s+social") or _label_value(r"nombre\s+o\s+razon\s+social")
        if v:
            customer_name = v
    if not customer_nit:
        v = _label_value(r"n[uú]mero\s+documento") or _label_value(r"numero\s+documento")
        if v:
            digits = _digits_only(v)
            if len(digits) >= 6:
                customer_nit = digits

    # Moneda
    currency = None
    if "usd" in text_norm:
        currency = "USD"
    elif "cop" in text_norm or "$" in text:
        currency = "COP"

    # Ítems (tabla) + subtotal derivado
    items, subtotal_from_items = _extract_items_from_text(text)

    monetary_computed: Dict[str, Any] = {}
    if subtotal_from_items is not None:
        monetary_computed["subtotalFromItems"] = f"{subtotal_from_items:.2f}"
        monetary_computed["totalFromItems"] = f"{subtotal_from_items:.2f}"

    return {
        "vendor": {"name": vendor_name, "nit": nit, "address": None},
        "customer": {"name": customer_name, "nit": customer_nit},
        "invoice": {
            "number": invoice_number,
            "date": invoice_date,
            "dueDate": due_date,
            "cufe": cufe,
            "currency": currency,
        },
        "dian": {"cufe": cufe, "resolutionNumber": None, "resolutionDate": None},
        "payment": {"method": None, "terms": None},
        "monetary": {
            "subtotal": f"{subtotal_val:.2f}" if subtotal_val is not None else None,
            "taxTotal": f"{iva_val:.2f}" if iva_val is not None else None,
            "withholdingTotal": f"{wh_val:.2f}" if wh_val is not None else None,
            "taxes": [],
            "withholdings": [],
            "total": f"{total_val:.2f}" if total_val is not None else None,
            **monetary_computed,
        },
        "items": items,
    }


def heuristic_extract_structured_co_payment(extracted_text: str) -> Dict[str, Any]:
    """Extractor heurístico (sin LLM) para confirmaciones de pago / recibos.

    Reusa el mismo schema para que la UI pueda mostrar campos comunes.
    """
    text = extracted_text or ""
    text_norm = normalize_text_for_match(text)

    # Vendor / marca
    vendor_name = None
    # Heurística simple: marcas conocidas (expandible)
    for brand in ("ubersuggest", "google", "gmail", "paypal", "stripe"):
        if brand in text_norm:
            vendor_name = brand.title() if brand != "ubersuggest" else "Ubersuggest"
            break

    # Factura # / Invoice #
    invoice_number = None
    mm = re.search(r"\bfactura\s*(?:#|no\.?|nro\.?|número)?\s*[:#-]?\s*([A-Z0-9\-]{3,})\b", text_norm, flags=re.IGNORECASE)
    if mm:
        invoice_number = mm.group(1).strip().upper()

    # Fecha (incluye formato con mes en español)
    invoice_date = None
    mm = re.search(r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b", text)
    date_raw = mm.group(1) if mm else None
    if not date_raw:
        mm = re.search(r"\b(\d{1,2}\s+de\s+[a-záéíóúñ]+\s+de\s+\d{4})\b", text_norm)
        date_raw = mm.group(1) if mm else None
    if date_raw:
        dt = parse_date_co(date_raw)
        if dt:
            invoice_date = dt.isoformat()

    # Total pagado (priorizar etiquetas antes que "máximo número")
    total_val = None
    total_labels = [
        r"total\s+pagado",
        r"total",
        r"pago",
        r"importe",
        r"amount",
    ]
    for lab in total_labels:
        mm = re.search(
            lab
            # Permitir texto intermedio (links/IDs) entre etiqueta y monto.
            + r"\b.{0,80}?(?:\$\s*)?(\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d{2}))\s*(?:\$|cop|usd)?",
            text_norm,
            flags=re.IGNORECASE,
        )
        if mm:
            total_val = parse_decimal_co(mm.group(1))
            if total_val is not None:
                break

    # Fallback: buscar montos pequeños con decimales y tomar el más frecuente
    if total_val is None:
        vals: List[float] = []
        for m in re.finditer(r"\b(\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d{2}))\b", text):
            parsed = parse_decimal_co(m.group(1))
            if parsed is not None:
                vals.append(parsed)
        if vals:
            # Preferir montos <= 1e6 para evitar años/IDs
            vals2 = [v for v in vals if 0 < v <= 1_000_000]
            total_val = max(vals2) if vals2 else max(vals)

    # Método de pago (tarjeta)
    method = None
    if "mastercard" in text_norm:
        method = "MASTERCARD"
    elif "visa" in text_norm:
        method = "VISA"
    elif "amex" in text_norm or "american express" in text_norm:
        method = "AMEX"

    currency = None
    if "$" in text or "usd" in text_norm:
        currency = "USD" if "usd" in text_norm else None
    if "cop" in text_norm:
        currency = "COP"

    return {
        "vendor": {"name": vendor_name, "nit": None, "address": None},
        "customer": {"name": None, "nit": None},
        "invoice": {
            "number": invoice_number,
            "date": invoice_date,
            "dueDate": None,
            "cufe": None,
            "currency": currency,
        },
        "dian": {"cufe": None, "resolutionNumber": None, "resolutionDate": None},
        "payment": {"method": method, "terms": None},
        "monetary": {
            "subtotal": None,
            "taxTotal": None,
            "withholdingTotal": None,
            "taxes": [],
            "withholdings": [],
            "total": f"{total_val:.2f}" if total_val is not None else None,
        },
        "items": [],
    }


def _configure_tesseract_cmd() -> None:
    # pytesseract usa un binario externo (tesseract.exe). En Windows, es común que no esté en PATH.
    env_cmd = os.getenv("TESSERACT_CMD")
    if env_cmd and os.path.exists(env_cmd):
        pytesseract.pytesseract.tesseract_cmd = env_cmd
        return

    # Intentar rutas típicas de instalación (UB Mannheim / instalador estándar)
    candidates = [
        r"C:\\Program Files\\Tesseract-OCR\\tesseract.exe",
        r"C:\\Program Files (x86)\\Tesseract-OCR\\tesseract.exe",
    ]
    for cand in candidates:
        if os.path.exists(cand):
            pytesseract.pytesseract.tesseract_cmd = cand
            return


_configure_tesseract_cmd()


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Evitar que FastAPI devuelva solo "Internal Server Error" sin detalle.
    # En entornos productivos conviene ocultar detalles; aquí ayuda a depurar.
    return JSONResponse(status_code=500, content={"detail": str(exc) or "Internal Server Error"})

# ===== Config =====
API_KEY = os.getenv("OCR_SERVICE_API_KEY")
LLM_BASE_URL = os.getenv("LLM_BASE_URL")  # OpenAI-compatible, ex: http://localhost:11434/v1
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "llama3.1:8b")

# PaddleOCR is heavy; initialize once.
_paddle_ocr: Optional[PaddleOCR] = None


def get_paddle_ocr(language: str) -> PaddleOCR:
    global _paddle_ocr
    if _paddle_ocr is None:
        # PaddleOCR 3.x depende de PaddlePaddle (módulo `paddle`).
        # Si no está disponible, permitimos que el caller haga fallback.
        try:
            import paddle  # noqa: F401
        except Exception as e:
            raise RuntimeError(
                "PaddlePaddle no está instalado (módulo 'paddle' no disponible). "
                "Configura provider=TESSERACT o instala paddlepaddle. "
                f"Detalle: {e}"
            )

        # PaddleOCR lang: 'es' works well for Spanish docs
        # Nota: PaddleOCR 3.x eliminó el parámetro `show_log`.
        try:
            _paddle_ocr = PaddleOCR(lang=language, use_angle_cls=True, show_log=False)
        except (TypeError, ValueError):
            _paddle_ocr = PaddleOCR(lang=language, use_angle_cls=True)
    return _paddle_ocr


def _is_tesseract_available() -> bool:
    try:
        _ = pytesseract.get_tesseract_version()
        return True
    except Exception:
        return False


def _tesseract_install_help() -> str:
    return (
        "Tesseract no está instalado o no está en PATH. "
        "En Windows puedes instalarlo y luego: (1) agregarlo al PATH o (2) setear TESSERACT_CMD "
        "apuntando a tesseract.exe (ej: C:\\Program Files\\Tesseract-OCR\\tesseract.exe)."
    )


def _map_tesseract_lang(language: str) -> str:
    # Tesseract usa códigos tipo 'spa', 'eng'. En la app enviamos 'es', 'en'.
    lang = (language or "").strip().lower()
    if lang in ("es", "es-co", "es_co", "spanish"):
        return "spa"
    if lang in ("en", "en-us", "en_us", "english"):
        return "eng"
    return language


def _require_api_key(x_api_key: Optional[str]):
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="No autorizado")


def pil_to_bgr(img: Image.Image) -> np.ndarray:
    rgb = img.convert("RGB")
    arr = np.array(rgb)
    return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)


def bgr_to_pil(bgr: np.ndarray) -> Image.Image:
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    return Image.fromarray(rgb)


def preprocess_bgr(bgr: np.ndarray) -> np.ndarray:
    # 1) Grayscale
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)

    # 2) Denoise
    den = cv2.fastNlMeansDenoising(gray, h=10)

    # 3) Adaptive threshold
    thr = cv2.adaptiveThreshold(
        den, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 15
    )

    # 4) Deskew (conservador): solo si hay suficiente tinta y el ángulo es pequeño.
    coords = np.column_stack(np.where(thr < 255))
    if coords.size > 0:
        # Evitar deskew en páginas casi vacías (reduce falsos positivos).
        ink_ratio = float(coords.shape[0]) / float(thr.shape[0] * thr.shape[1])
        if ink_ratio >= 0.001:
            angle = cv2.minAreaRect(coords)[-1]
            if angle < -45:
                angle = -(90 + angle)
            else:
                angle = -angle

            # Deskew solo para ángulos razonables.
            if 0.3 < abs(angle) <= 7.0:
                (h, w) = thr.shape[:2]
                center = (w // 2, h // 2)
                M = cv2.getRotationMatrix2D(center, angle, 1.0)
                thr = cv2.warpAffine(thr, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)

    return thr


def load_pages(file_bytes: bytes, mime_type: str) -> List[Image.Image]:
    if mime_type == "application/pdf":
        def _pdf_to_images_pymupdf(pdf_bytes: bytes) -> List[Image.Image]:
            try:
                import fitz  # PyMuPDF
            except Exception as e:
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "No se pudo procesar PDF. Dependencias faltantes. "
                        f"Instala 'pymupdf' o 'pdf2image'. Detalle: {e}"
                    ),
                )

            try:
                doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"PDF inválido o corrupto: {e}")

            images: List[Image.Image] = []
            # Matriz 3x ≈ 216 DPI (mejor para textos pequeños)
            mat = fitz.Matrix(3, 3)
            for page in doc:
                pix = page.get_pixmap(matrix=mat, alpha=False)
                img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
                images.append(img)
            return images

        # 1) Intentar pdf2image (requiere Poppler a nivel sistema)
        try:
            from pdf2image import convert_from_bytes

            try:
                pages = convert_from_bytes(file_bytes, dpi=250)
                return pages
            except Exception:
                # Si falla (típico: Poppler faltante), hacemos fallback a PyMuPDF
                return _pdf_to_images_pymupdf(file_bytes)
        except Exception:
            # 2) Si pdf2image no está disponible, fallback a PyMuPDF
            return _pdf_to_images_pymupdf(file_bytes)

    try:
        img = Image.open(io.BytesIO(file_bytes))
        return [img]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Archivo de imagen inválido: {e}")


def paddle_ocr_page(bgr: np.ndarray, language: str) -> Dict[str, Any]:
    ocr = get_paddle_ocr(language)
    # PaddleOCR espera RGB o ruta; le damos RGB numpy
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    result = ocr.ocr(rgb, cls=True)

    lines: List[Dict[str, Any]] = []
    confs: List[float] = []

    for block in result or []:
        for item in block or []:
            box, (text, conf) = item
            conf_val = float(conf) if conf is not None else 0.0
            confs.append(conf_val)
            xs = [float(p[0]) for p in box]
            ys = [float(p[1]) for p in box]
            lines.append({
                "text": str(text).strip(),
                "confidence": conf_val,
                "box": box,
                "bbox": {
                    "x1": min(xs),
                    "y1": min(ys),
                    "x2": max(xs),
                    "y2": max(ys),
                },
            })

    extracted_text = "\n".join([l["text"] for l in lines if l["text"]]).strip()
    avg_conf = float(sum(confs) / len(confs)) if confs else 0.0

    return {
        "lines": lines,
        "avgConfidence": avg_conf,
        "text": extracted_text,
    }


def _group_rows_by_y(lines: List[Dict[str, Any]], y_threshold: float = 12.0) -> List[List[Dict[str, Any]]]:
    # Agrupa líneas por cercanía vertical (heurística)
    ordered = sorted(lines, key=lambda l: float((l.get("bbox") or {}).get("y1", 0.0)))
    rows: List[List[Dict[str, Any]]] = []
    for line in ordered:
        y = float((line.get("bbox") or {}).get("y1", 0.0))
        if not rows:
            rows.append([line])
            continue
        last_row = rows[-1]
        last_y = float((last_row[0].get("bbox") or {}).get("y1", 0.0))
        if abs(y - last_y) <= y_threshold:
            last_row.append(line)
        else:
            rows.append([line])
    # Ordenar cada fila por X
    for r in rows:
        r.sort(key=lambda l: float((l.get("bbox") or {}).get("x1", 0.0)))
    return rows


def detect_layout(paddle_lines: List[Dict[str, Any]], width: int, height: int) -> Dict[str, Any]:
    # Segmentación simple por zonas
    header_y = 0.25 * height
    totals_y = 0.75 * height

    header = [l for l in paddle_lines if float((l.get("bbox") or {}).get("y1", 0.0)) <= header_y]
    totals = [l for l in paddle_lines if float((l.get("bbox") or {}).get("y1", 0.0)) >= totals_y]
    body = [l for l in paddle_lines if l not in header and l not in totals]

    body_rows = _group_rows_by_y(body, y_threshold=max(10.0, height * 0.012))

    # Heurística de tabla: filas con >=3 "celdas"
    table_rows: List[Dict[str, Any]] = []
    for r in body_rows:
        if len(r) >= 3:
            cells = [c.get("text") for c in r]
            xs = [float((c.get("bbox") or {}).get("x1", 0.0)) for c in r]
            table_rows.append({"cells": cells, "x": xs})

    return {
        "blocks": {
            "header": {
                "text": "\n".join([l.get("text", "") for l in header]).strip(),
                "count": len(header),
            },
            "body": {
                "count": len(body),
            },
            "totals": {
                "text": "\n".join([l.get("text", "") for l in totals]).strip(),
                "count": len(totals),
            },
        },
        "table": {
            "rowCount": len(table_rows),
            "rows": table_rows[:50],
        },
    }


def tesseract_ocr_page(bgr: np.ndarray, language: str) -> Dict[str, Any]:
    # pytesseract requiere Tesseract instalado (binario). En Windows: instala y añade al PATH.
    logger.info("[DEBUG] tesseract_ocr_page: Verificando disponibilidad de Tesseract...")
    is_available = _is_tesseract_available()
    logger.info(f"[DEBUG] tesseract_ocr_page: Tesseract disponible = {is_available}")
    if not is_available:
        logger.error("[DEBUG] tesseract_ocr_page: Tesseract NO disponible, lanzando error")
        raise RuntimeError(_tesseract_install_help())

    logger.info("[DEBUG] tesseract_ocr_page: Convirtiendo imagen...")
    tess_lang = _map_tesseract_lang(language)

    def prep_variants(src_bgr: np.ndarray) -> List[Tuple[str, Image.Image]]:
        variants: List[Tuple[str, Image.Image]] = []
        # 1) Sin binarizar (a veces mejor para PDFs nativos)
        variants.append(("raw", bgr_to_pil(src_bgr)))

        # 2) Grayscale + denoise (sin threshold)
        gray = cv2.cvtColor(src_bgr, cv2.COLOR_BGR2GRAY)
        den = cv2.fastNlMeansDenoising(gray, h=10)
        variants.append(("gray_denoise", Image.fromarray(den)))

        # 3) Threshold adaptativo (tu pipeline actual)
        thr = preprocess_bgr(src_bgr)
        variants.append(("adaptive_threshold", Image.fromarray(thr)))

        # 4) Otsu (otro clásico)
        try:
            _, otsu = cv2.threshold(den, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            variants.append(("otsu_threshold", Image.fromarray(otsu)))
        except Exception:
            pass

        return variants

    def score_text(text: str) -> float:
        q = _text_quality(text)
        # Score 0..1 (aprox). Premia palabras reales y contenido alfanumérico.
        word_score = min(1.0, float(q["wordLikeCount"]) / 40.0)
        return (0.55 * word_score) + (0.35 * float(q["alnumRatio"])) + (0.10 * float(q["printableRatio"]))

    def ocr_once(pil: Image.Image, config: str) -> Dict[str, Any]:
        try:
            data = pytesseract.image_to_data(
                pil, lang=tess_lang, config=config, output_type=pytesseract.Output.DICT
            )
            extracted_text = pytesseract.image_to_string(pil, lang=tess_lang, config=config).strip()
        except pytesseract.pytesseract.TesseractError as e:
            raise RuntimeError(
                f"Tesseract falló con lang='{tess_lang}'. Verifica idioma instalado (ej: tesseract-ocr-spa). Detalle: {e}"
            )
        except pytesseract.pytesseract.TesseractNotFoundError:
            raise RuntimeError(_tesseract_install_help())

        words: List[Dict[str, Any]] = []
        confs: List[float] = []

        n = len(data.get("text", []))
        for i in range(n):
            text = (data["text"][i] or "").strip()
            conf = float(data["conf"][i]) if str(data["conf"][i]).strip() not in ("-1", "") else -1.0
            if text:
                w = {
                    "text": text,
                    "confidence": conf,
                    "bbox": {
                        "x": int(data["left"][i]),
                        "y": int(data["top"][i]),
                        "w": int(data["width"][i]),
                        "h": int(data["height"][i]),
                    },
                }
                words.append(w)
                if conf >= 0:
                    confs.append(conf)

        avg_conf = float(sum(confs) / len(confs)) if confs else 0.0
        return {
            "words": words,
            "avgConfidence": avg_conf,  # 0..100
            "text": extracted_text,
        }

    # Intentar varias configuraciones. Típicos:
    # - psm 6: bloque de texto uniforme
    # - psm 4: columnas
    # - psm 11: texto disperso
    configs = ["--oem 1 --psm 6", "--oem 1 --psm 4", "--oem 1 --psm 11"]

    best: Optional[Dict[str, Any]] = None
    best_meta: Dict[str, Any] = {"score": -1.0}

    for vname, pil in prep_variants(bgr):
        for cfg in configs:
            res = ocr_once(pil, cfg)
            txt = str(res.get("text") or "")
            s = score_text(txt)
            # Tiebreaker: avgConfidence (0..100) -> 0..1
            s2 = s + (0.05 * (float(res.get("avgConfidence") or 0.0) / 100.0))
            if s2 > float(best_meta.get("score", -1.0)):
                best = res
                best_meta = {
                    "score": float(s2),
                    "variant": vname,
                    "config": cfg,
                    "quality": _text_quality(txt),
                }

            # Early-exit si ya es claramente usable
            if _is_usable_text(txt) and s2 >= 0.65:
                best = res
                best_meta = {
                    "score": float(s2),
                    "variant": vname,
                    "config": cfg,
                    "quality": _text_quality(txt),
                }
                break
        if best and _is_usable_text(str(best.get("text") or "")) and float(best_meta.get("score", 0.0)) >= 0.65:
            break

    if not best:
        # fallback extremo: devuelve OCR raw con config default
        best = ocr_once(bgr_to_pil(bgr), "--oem 1 --psm 6")
        best_meta = {
            "score": score_text(str(best.get("text") or "")),
            "variant": "raw",
            "config": "--oem 1 --psm 6",
            "quality": _text_quality(str(best.get("text") or "")),
        }

    best["_debug"] = best_meta
    return best


def _text_quality(text: str) -> Dict[str, Any]:
    t = text or ""
    total = len(t)
    letters = sum(1 for c in t if c.isalpha())
    digits = sum(1 for c in t if c.isdigit())
    whitespace = sum(1 for c in t if c.isspace())
    printable = sum(1 for c in t if c.isprintable())
    symbols = max(0, total - (letters + digits + whitespace))
    word_like = len(re.findall(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,}", t))

    def ratio(n: int) -> float:
        return float(n) / float(total) if total else 0.0

    return {
        "length": total,
        "alphaRatio": ratio(letters),
        "alnumRatio": ratio(letters + digits),
        "symbolRatio": ratio(symbols),
        "printableRatio": ratio(printable),
        "wordLikeCount": int(word_like),
    }


def _is_usable_text(text: str) -> bool:
    q = _text_quality(text)
    # Texto "usable" típicamente tiene varias palabras, buena proporción alfanumérica y tamaño suficiente.
    return bool(
        q["length"] >= 80
        and q["wordLikeCount"] >= 8
        and q["alnumRatio"] >= 0.20
        and q["printableRatio"] >= 0.85
    )


def extract_pdf_text_pymupdf(pdf_bytes: bytes, max_pages: int = 10) -> Tuple[str, List[Dict[str, Any]]]:
    """Extrae texto embebido del PDF (si existe) sin OCR.

    Esto suele ser clave en PDFs "nativos" (ej: exportados de Gmail/ERP), donde OCR por imagen
    puede salir mal o innecesario.
    """
    try:
        import fitz  # PyMuPDF
    except Exception:
        return "", []

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception:
        return "", []

    pages_info: List[Dict[str, Any]] = []
    texts: List[str] = []
    for i, page in enumerate(doc):
        if i >= max_pages:
            break
        page_text = ""
        mode_used = "text"
        try:
            page_text = (page.get_text("text") or "").strip()
        except Exception:
            page_text = ""

        # Fallback: a veces "text" viene casi vacío por encoding; probamos dict/spans.
        if len(page_text) < 40:
            try:
                d = page.get_text("dict")
                parts: List[str] = []
                for b in (d or {}).get("blocks", []) or []:
                    for ln in (b or {}).get("lines", []) or []:
                        for sp in (ln or {}).get("spans", []) or []:
                            s = str((sp or {}).get("text") or "").strip()
                            if s:
                                parts.append(s)
                alt = "\n".join(parts).strip()
                if len(alt) > len(page_text):
                    page_text = alt
                    mode_used = "dict"
            except Exception:
                pass

        # Fallback adicional: blocks
        if len(page_text) < 40:
            try:
                blocks = page.get_text("blocks")
                parts2: List[str] = []
                for blk in blocks or []:
                    if len(blk) >= 5:
                        s = str(blk[4] or "").strip()
                        if s:
                            parts2.append(s)
                alt2 = "\n".join(parts2).strip()
                if len(alt2) > len(page_text):
                    page_text = alt2
                    mode_used = "blocks"
            except Exception:
                pass
        texts.append(page_text)
        pages_info.append({
            "pageIndex": int(i),
            "charCount": int(len(page_text)),
            "mode": mode_used,
            "quality": _text_quality(page_text),
        })

    combined = "\n\n".join([t for t in texts if t]).strip()
    return combined, pages_info


def parse_decimal_co(value: str) -> Optional[float]:
    if not value:
        return None
    s = value.strip()
    s = re.sub(r"[^0-9,\.\-]", "", s)
    if not s:
        return None

    # Heurística robusta para separadores:
    # - CO suele usar miles con '.' y decimales con ','
    # - pero en PDFs/email es común ver miles con ',' sin decimales (ej: 145,930)
    has_dot = "." in s
    has_comma = "," in s

    if has_dot and has_comma:
        # Tomar el ÚLTIMO separador como el decimal probable.
        last_dot = s.rfind(".")
        last_comma = s.rfind(",")
        if last_comma > last_dot:
            # '.' miles, ',' decimales
            s = s.replace(".", "")
            s = s.replace(",", ".")
        else:
            # ',' miles, '.' decimales
            s = s.replace(",", "")
    elif has_comma and not has_dot:
        # Un solo ',' puede ser decimal (2 dígitos) o miles (3 dígitos)
        if s.count(",") == 1:
            left, right = s.split(",", 1)
            if len(right) == 3 and len(left) >= 1:
                # 145,930 => miles
                s = left + right
            else:
                # 145,93 => decimal
                s = left + "." + right
        else:
            # 1,234,567 => miles
            s = s.replace(",", "")
    elif has_dot and not has_comma:
        # '.' puede ser decimal (2 dígitos) o miles (3 dígitos)
        if s.count(".") == 1:
            left, right = s.split(".", 1)
            if len(right) == 3 and len(left) >= 1:
                s = left + right
            # si es 2 dígitos, se deja como decimal
        else:
            # 1.234.567 => miles
            s = s.replace(".", "")

    try:
        return float(s)
    except Exception:
        return None


def parse_date_co(value: str) -> Optional[datetime]:
    v = (value or "").strip()
    if not v:
        return None
    # 1) Formato numérico dd/mm/aaaa o dd-mm-aa
    m = re.match(r"^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$", v)
    if m:
        d = int(m.group(1))
        mo = int(m.group(2))
        y = int(m.group(3))
        if y < 100:
            y = 2000 + y
        try:
            return datetime(y, mo, d)
        except Exception:
            return None

    # 1b) ISO yyyy-mm-dd (común en PDFs exportados)
    m_iso = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})$", v)
    if m_iso:
        try:
            y = int(m_iso.group(1))
            mo = int(m_iso.group(2))
            d = int(m_iso.group(3))
            return datetime(y, mo, d)
        except Exception:
            return None

    # 2) Formato en español: "3 de diciembre de 2025" (típico en PDFs de email)
    months = {
        "enero": 1,
        "febrero": 2,
        "marzo": 3,
        "abril": 4,
        "mayo": 5,
        "junio": 6,
        "julio": 7,
        "agosto": 8,
        "septiembre": 9,
        "setiembre": 9,
        "octubre": 10,
        "noviembre": 11,
        "diciembre": 12,
    }
    v_norm = normalize_text_for_match(v)
    m2 = re.search(r"\b(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de\s+(\d{4})\b", v_norm)
    if m2:
        try:
            d = int(m2.group(1))
            mo = months.get(m2.group(2))
            y = int(m2.group(3))
            if mo:
                return datetime(y, mo, d)
        except Exception:
            return None

    return None


def normalize_text_for_match(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip().lower()


def nit_check_digit(nit: str) -> Optional[int]:
    digits = re.sub(r"\D", "", nit or "")
    if len(digits) < 6:
        return None

    # DIAN weights
    weights = [71, 67, 59, 53, 47, 43, 41, 37, 29, 23, 19, 17, 13, 7, 3]
    digits_list = [int(d) for d in digits]

    # align from right
    w = weights[-len(digits_list):]
    total = sum(d * ww for d, ww in zip(digits_list, w))
    mod = total % 11
    dv = mod if mod < 2 else 11 - mod
    return dv


def validate_invoice_rules(structured: Dict[str, Any]) -> List[Dict[str, Any]]:
    issues: List[Dict[str, Any]] = []

    money = structured.get("monetary", {}) if isinstance(structured.get("monetary"), dict) else {}

    subtotal = parse_decimal_co(str(money.get("subtotal") or ""))
    total = parse_decimal_co(str(money.get("total") or ""))

    taxes = money.get("taxes") if isinstance(money.get("taxes"), list) else []
    withholdings = money.get("withholdings") if isinstance(money.get("withholdings"), list) else []

    tax_sum = 0.0
    for t in taxes:
        amount = parse_decimal_co(str((t or {}).get("amount") or ""))
        if amount is not None:
            tax_sum += amount

    wh_sum = 0.0
    for w in withholdings:
        amount = parse_decimal_co(str((w or {}).get("amount") or ""))
        if amount is not None:
            wh_sum += amount

    if subtotal is not None and total is not None:
        expected = subtotal + tax_sum - wh_sum
        if abs(expected - total) > 2.0:
            issues.append({
                "code": "TOTAL_MISMATCH",
                "message": f"Total inconsistente: esperado {expected:.2f} vs leído {total:.2f}",
                "severity": "HIGH",
            })

    # Fecha
    date_str = structured.get("invoice", {}).get("date") if isinstance(structured.get("invoice"), dict) else None
    if date_str:
        try:
            dt = datetime.fromisoformat(str(date_str).replace("Z", "+00:00"))
            if dt.year < 2000 or dt.year > datetime.utcnow().year + 1:
                issues.append({"code": "DATE_RANGE", "message": "Fecha fuera de rango razonable", "severity": "MEDIUM"})
        except Exception:
            issues.append({"code": "DATE_PARSE", "message": "No se pudo interpretar la fecha", "severity": "MEDIUM"})

    # NIT
    vendor_nit = None
    vendor = structured.get("vendor", {}) if isinstance(structured.get("vendor"), dict) else {}
    vendor_nit = vendor.get("nit")
    if vendor_nit:
        dv_match = re.search(r"(\d+)\s*[-–]\s*(\d)", str(vendor_nit))
        if dv_match:
            base = dv_match.group(1)
            dv = int(dv_match.group(2))
            calc = nit_check_digit(base)
            if calc is not None and dv != calc:
                issues.append({"code": "NIT_DV", "message": "Dígito de verificación NIT no coincide", "severity": "HIGH"})

    return issues


def extract_email_candidates(text: str) -> List[str]:
    if not text:
        return []
    seen: List[str] = []
    for match in re.findall(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", text, flags=re.IGNORECASE):
        value = str(match).strip().lower()
        if value and value not in seen:
            seen.append(value)
    return seen


def normalize_phone_co(value: str) -> Optional[str]:
    digits = re.sub(r"\D", "", value or "")
    if not digits:
        return None
    if len(digits) >= 12 and digits.startswith("57"):
        digits = digits[-10:]
    if len(digits) < 7:
        return None
    return digits


def extract_phone_candidates(text: str) -> List[str]:
    if not text:
        return []
    seen: List[str] = []
    pattern = re.compile(r"(?:\+?57\s*)?(?:\(?\d{3}\)?[\s\-.]*)?\d{3}[\s\-.]*\d{4}")
    for raw in pattern.findall(text):
        normalized = normalize_phone_co(str(raw))
        if normalized and normalized not in seen:
            seen.append(normalized)
    return seen


def extract_labeled_value(text: str, labels: List[str]) -> Optional[str]:
    if not text:
        return None
    joined = "|".join(re.escape(label) for label in labels)
    pattern = re.compile(rf"(?im)^(?:{joined})\s*[:\-]\s*(.+)$")
    match = pattern.search(text)
    if not match:
        return None
    value = re.split(r"\s{2,}|[|•]", str(match.group(1)).strip())[0].strip()
    return value or None


def infer_request_summary(text: str, subject: str = "") -> Optional[str]:
    candidates: List[str] = []
    labeled = extract_labeled_value(text, ["solicitud", "requerimiento", "mensaje", "necesidad", "detalle"])
    if labeled:
        candidates.append(labeled)

    raw_sentences = [part.strip() for part in re.split(r"[\n\r]+|(?<=[\.!?])\s+", text or "") if part.strip()]
    interesting_tokens = ("cotiz", "presupuesto", "necesito", "requier", "quiero", "solicito", "busco", "pedido", "orden")
    for sentence in raw_sentences:
        normalized = normalize_text_for_match(sentence)
        if any(token in normalized for token in interesting_tokens):
            candidates.append(sentence)
            break

    if subject:
        candidates.append(subject.strip())

    for item in candidates:
        cleaned = re.sub(r"\s+", " ", item).strip(" .:-")
        if len(cleaned) >= 8:
            return cleaned[:280]
    return None


def infer_product_or_service(text: str, subject: str = "") -> Optional[str]:
    combined = "\n".join(part for part in [subject, text] if part).strip()
    if not combined:
        return None
    patterns = [
        r"(?i)(?:cotizar|cotización|cotizacion|necesito|requiero|quiero|busco)\s+(?:una|un|unos|unas|el|la|de)?\s*([^\.\n\r,;:]{4,120})",
        r"(?i)(?:servicio|producto)\s+de\s+([^\.\n\r,;:]{4,120})",
    ]
    for pattern in patterns:
        match = re.search(pattern, combined)
        if match:
            value = re.sub(r"\s+", " ", str(match.group(1)).strip())
            if value:
                return value[:120]
    return None


def infer_request_intent(text: str, subject: str = "") -> Optional[str]:
    normalized = normalize_text_for_match(f"{subject}\n{text}")
    if any(token in normalized for token in ["cotiz", "presupuesto", "quote"]):
        return "QUOTE_REQUEST"
    if any(token in normalized for token in ["comprar", "pedido", "orden", "ordenar"]):
        return "PURCHASE_INTENT"
    if any(token in normalized for token in ["informacion", "información", "asesoria", "asesoría", "consulta"]):
        return "INFORMATION_REQUEST"
    return None


def heuristic_extract_email_lead(extracted_text: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    metadata = metadata or {}
    subject = str(metadata.get("subject") or "").strip()
    from_name = str(metadata.get("fromName") or "").strip()
    from_address = str(metadata.get("fromAddress") or "").strip().lower()
    fallback_phone = normalize_phone_co(str(metadata.get("phone") or ""))
    fallback_company = str(metadata.get("company") or "").strip()
    fallback_city = str(metadata.get("city") or "").strip()

    email_candidates = extract_email_candidates(extracted_text)
    phone_candidates = extract_phone_candidates(extracted_text)
    name = extract_labeled_value(extracted_text, ["nombre", "nombre completo", "contacto", "cliente", "prospecto"])
    company = extract_labeled_value(extracted_text, ["empresa", "compañia", "compania", "negocio", "razón social", "razon social"])
    city = extract_labeled_value(extracted_text, ["ciudad", "municipio", "ubicación", "ubicacion"])
    document = extract_labeled_value(extracted_text, ["nit", "cc", "cedula", "cédula", "documento"])
    summary = infer_request_summary(extracted_text, subject)
    product = infer_product_or_service(extracted_text, subject)
    intent = infer_request_intent(extracted_text, subject)

    if not name and from_name and "@" not in from_name:
        name = from_name

    return {
        "contact": {
            "name": name or None,
            "email": email_candidates[0] if email_candidates else (from_address or None),
            "phone": phone_candidates[0] if phone_candidates else fallback_phone,
            "company": company or (fallback_company or None),
            "city": city or (fallback_city or None),
            "document": document or None,
        },
        "request": {
            "summary": summary,
            "intent": intent,
            "productOrService": product,
            "urgency": "HIGH" if "urgente" in normalize_text_for_match(extracted_text) else None,
        },
        "fieldConfidences": {
            "contact.name": 0.65 if name else 0.0,
            "contact.email": 0.9 if email_candidates else (0.75 if from_address else 0.0),
            "contact.phone": 0.85 if phone_candidates else (0.6 if fallback_phone else 0.0),
            "contact.company": 0.65 if company else (0.45 if fallback_company else 0.0),
            "contact.city": 0.65 if city else (0.45 if fallback_city else 0.0),
            "contact.document": 0.6 if document else 0.0,
            "request.summary": 0.55 if summary else 0.0,
            "request.productOrService": 0.5 if product else 0.0,
        },
    }


async def llm_extract_email_lead(extracted_text: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    if not LLM_BASE_URL:
        return {"llmUsed": False, "structured": None, "fieldConfidences": {}, "warnings": ["LLM_BASE_URL no configurado"]}

    base = LLM_BASE_URL.rstrip("/")
    url = f"{base}/chat/completions"

    system = (
        "Eres un extractor de leads comerciales desde correos en español. "
        "Devuelve SOLO JSON válido. "
        "Reglas: (1) No inventes datos; usa null si no hay evidencia clara. "
        "(2) request.summary debe ser una cita breve o fragmento muy cercano al texto real, no una paráfrasis libre. "
        "(3) Si un dato viene solo en metadata del remitente, puedes usarlo. "
        "(4) Devuelve fieldConfidences con valores entre 0 y 1."
    )

    user = {
        "language": "es",
        "channel": "email",
        "email": {
            "subject": str((metadata or {}).get("subject") or ""),
            "fromName": str((metadata or {}).get("fromName") or ""),
            "fromAddress": str((metadata or {}).get("fromAddress") or ""),
            "bodyText": extracted_text,
        },
        "output_schema": {
            "contact": {
                "name": "string|null",
                "email": "string|null",
                "phone": "string|null",
                "company": "string|null",
                "city": "string|null",
                "document": "string|null",
            },
            "request": {
                "summary": "string|null",
                "intent": "QUOTE_REQUEST|PURCHASE_INTENT|INFORMATION_REQUEST|null",
                "productOrService": "string|null",
                "urgency": "HIGH|NORMAL|LOW|null",
            },
            "evidence": {
                "contact": {},
                "request": {},
            },
            "fieldConfidences": "object<string, number 0..1>",
        },
    }

    payload = {
        "model": LLM_MODEL,
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": str(user)},
        ],
    }

    headers = {"Content-Type": "application/json"}
    if LLM_API_KEY:
        headers["Authorization"] = f"Bearer {LLM_API_KEY}"

    async with httpx.AsyncClient(timeout=45) as client:
        r = await client.post(url, json=payload, headers=headers)
        if r.status_code >= 400:
            raise HTTPException(status_code=500, detail=f"LLM error {r.status_code}: {r.text}")
        data = r.json()

    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    try:
        structured = json.loads(content)
    except Exception:
        return {"llmUsed": True, "structured": None, "fieldConfidences": {}, "warnings": ["LLM devolvió JSON inválido"]}

    return {
        "llmUsed": True,
        "structured": structured,
        "fieldConfidences": structured.get("fieldConfidences", {}) if isinstance(structured, dict) else {},
        "warnings": [],
    }


def build_email_lead_evidence_snippets(extracted_text: str, structured: Dict[str, Any]) -> Dict[str, str]:
    snippets: Dict[str, str] = {}
    for path in (
        "contact.name",
        "contact.email",
        "contact.phone",
        "contact.company",
        "contact.city",
        "contact.document",
        "request.summary",
        "request.productOrService",
    ):
        value = _get_by_path(structured, path)
        if value is None:
            continue
        snippet = _find_snippet(extracted_text, str(value))
        if snippet:
            snippets[path] = snippet
    return snippets


def enforce_no_hallucination_email_lead(
    extracted_text: str,
    structured: Optional[Dict[str, Any]],
    metadata: Optional[Dict[str, Any]] = None,
) -> Tuple[Optional[Dict[str, Any]], Dict[str, float], List[str]]:
    if not isinstance(structured, dict):
        return structured, {}, []

    metadata = metadata or {}
    warnings: List[str] = []
    confs: Dict[str, float] = {}
    text_norm = normalize_text_for_match(extracted_text or "")

    def _value_in_text(path: str, value: str) -> bool:
        if path == "contact.phone":
            digits = normalize_phone_co(value)
            if not digits:
                return False
            all_digits = re.sub(r"\D", "", extracted_text or "")
            return digits in all_digits
        return normalize_text_for_match(value) in text_norm

    def _value_matches_metadata(path: str, value: str) -> bool:
        allowed_map = {
            "contact.name": str(metadata.get("fromName") or ""),
            "contact.email": str(metadata.get("fromAddress") or ""),
            "contact.phone": str(metadata.get("phone") or ""),
            "contact.company": str(metadata.get("company") or ""),
            "contact.city": str(metadata.get("city") or ""),
            "request.summary": str(metadata.get("subject") or ""),
        }
        allowed = allowed_map.get(path) or ""
        if not allowed:
            return False
        if path == "contact.phone":
            return normalize_phone_co(value or "") == normalize_phone_co(allowed)
        return normalize_text_for_match(value) == normalize_text_for_match(allowed)

    def check_field(path: str, value: Optional[str]):
        if value is None:
            confs[path] = 0.0
            return None
        raw = str(value).strip()
        if not raw:
            confs[path] = 0.0
            return None
        in_text = _value_in_text(path, raw)
        in_metadata = _value_matches_metadata(path, raw)
        if not in_text and not in_metadata:
            warnings.append(f"Sin evidencia textual ni metadata para {path}; se anuló")
            confs[path] = 0.2
            return None
        confs[path] = 0.85 if in_text else 0.7
        return raw

    contact = structured.get("contact") if isinstance(structured.get("contact"), dict) else {}
    request = structured.get("request") if isinstance(structured.get("request"), dict) else {}

    contact["name"] = check_field("contact.name", contact.get("name"))
    contact["email"] = check_field("contact.email", contact.get("email"))
    contact["phone"] = check_field("contact.phone", contact.get("phone"))
    contact["company"] = check_field("contact.company", contact.get("company"))
    contact["city"] = check_field("contact.city", contact.get("city"))
    contact["document"] = check_field("contact.document", contact.get("document"))
    request["summary"] = check_field("request.summary", request.get("summary"))
    request["productOrService"] = check_field("request.productOrService", request.get("productOrService"))

    if not request.get("intent"):
        request["intent"] = infer_request_intent(extracted_text, str(metadata.get("subject") or ""))

    structured["contact"] = contact
    structured["request"] = request
    return structured, confs, warnings


def compute_text_capture_percent(field_confs: Dict[str, float], structured: Optional[Dict[str, Any]] = None) -> int:
    if not isinstance(structured, dict):
        return 0

    def is_present(value: Any) -> bool:
        if value is None:
            return False
        return bool(str(value).strip())

    contact = structured.get("contact") if isinstance(structured.get("contact"), dict) else {}
    request = structured.get("request") if isinstance(structured.get("request"), dict) else {}
    fields = [
        contact.get("name"),
        contact.get("email"),
        contact.get("phone"),
        request.get("summary"),
        request.get("productOrService"),
    ]
    completeness = sum(1 for field in fields if is_present(field)) / max(1, len(fields))
    conf_vals = [float(v) for v in (field_confs or {}).values() if v is not None]
    confidence = (sum(conf_vals) / len(conf_vals)) if conf_vals else 0.0
    score = int(round(((completeness * 0.65) + (confidence * 0.35)) * 100.0))
    return max(0, min(100, score))


async def llm_extract_invoice(extracted_text: str, layout_hint: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    if not LLM_BASE_URL:
        return {"llmUsed": False, "structured": None, "fieldConfidences": {}, "warnings": ["LLM_BASE_URL no configurado"]}

    base = LLM_BASE_URL.rstrip("/")
    url = f"{base}/chat/completions"

    system = (
        "Eres un extractor de facturas colombianas (DIAN). "
        "Devuelve SOLO JSON válido. "
        "Reglas: (1) No inventes datos; si no hay evidencia textual clara, usa null. "
        "(2) Para cada campo, incluye un objeto evidence con un fragmento EXACTO que exista en el texto OCR. "
        "(3) Normaliza números en formato colombiano y devuelve también rawText cuando aplique."
    )

    user = {
        "country": "CO",
        "language": "es",
        "document": {
            "type": "FACTURA",
            "ocrText": extracted_text,
        },
        "layout_hint": layout_hint or {},
        "output_schema": {
            "vendor": {"name": "string|null", "nit": "string|null", "address": "string|null"},
            "customer": {"name": "string|null", "nit": "string|null"},
            "invoice": {
                "number": "string|null",
                "date": "ISO8601|null",
                "dueDate": "ISO8601|null",
                "cufe": "string|null",
                "currency": "string|null",
            },
            "dian": {"cufe": "string|null", "resolutionNumber": "string|null", "resolutionDate": "ISO8601|null"},
            "payment": {"method": "string|null", "terms": "string|null"},
            "monetary": {
                "subtotal": "string|null",
                "taxTotal": "string|null",
                "withholdingTotal": "string|null",
                "taxes": [{"type": "string", "rate": "string|null", "amount": "string|null"}],
                "withholdings": [{"type": "string", "rate": "string|null", "amount": "string|null"}],
                "total": "string|null",
            },
            "items": [{"description": "string", "qty": "string|null", "unitPrice": "string|null", "amount": "string|null"}],
            "evidence": {"vendor": {}, "customer": {}, "invoice": {}, "monetary": {}, "items": []},
            "fieldConfidences": "object<string, number 0..1>",
        },
    }

    payload = {
        "model": LLM_MODEL,
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": str(user)},
        ],
    }

    headers = {"Content-Type": "application/json"}
    if LLM_API_KEY:
        headers["Authorization"] = f"Bearer {LLM_API_KEY}"

    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(url, json=payload, headers=headers)
        if r.status_code >= 400:
            raise HTTPException(status_code=500, detail=f"LLM error {r.status_code}: {r.text}")
        data = r.json()

    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    try:
        import json

        structured = json.loads(content)
    except Exception:
        return {"llmUsed": True, "structured": None, "fieldConfidences": {}, "warnings": ["LLM devolvió JSON inválido"]}

    return {
        "llmUsed": True,
        "structured": structured,
        "fieldConfidences": structured.get("fieldConfidences", {}) if isinstance(structured, dict) else {},
        "warnings": [],
    }


def enforce_no_hallucination(extracted_text: str, structured: Optional[Dict[str, Any]]) -> Tuple[Optional[Dict[str, Any]], Dict[str, float], List[str]]:
    if not isinstance(structured, dict):
        return structured, {}, []

    warnings: List[str] = []
    confs: Dict[str, float] = {}

    text_raw = extracted_text or ""
    text_norm = normalize_text_for_match(text_raw)

    def _money_value_in_text(raw_text: str, value: str) -> bool:
        """Retorna True si `value` (monto) aparece en el texto aunque cambie ,/."""
        amt = parse_decimal_co(str(value))
        if amt is None:
            return False

        # Variantes comunes para evitar falsos negativos por separador decimal.
        # Nota: mantenemos 2 decimales porque es lo que serializamos en structured.
        base = f"{amt:.2f}"
        variants = {
            base,
            base.replace(".", ","),
        }
        # También permitir miles (muy básico) si aplica.
        if amt >= 1000:
            variants.add(f"{amt:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."))  # 1.234,56
            variants.add(f"{amt:,.2f}")  # 1,234.56
            # En muchos PDFs viene sin decimales: "$145,930" / "$145.930"
            variants.add(f"{amt:,.0f}".replace(",", "X").replace(".", ",").replace("X", "."))  # 145.930
            variants.add(f"{amt:,.0f}")  # 145,930

        raw_norm = normalize_text_for_match(raw_text)
        for v in variants:
            if normalize_text_for_match(v) in raw_norm:
                return True

        # Fallback robusto: buscar cualquier número con separadores (con o sin decimales) y comparar por valor.
        # Limitamos a patrones de dinero típicos para reducir falsos positivos.
        for m in re.finditer(
            r"(?:(?:usd|cop|\\$)\s*)?(\d{1,3}(?:[\.,]\d{3})+(?:[\.,]\d{2})?|\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d{2}))\s*(?:usd|cop|\\$)?",
            raw_text,
            flags=re.IGNORECASE,
        ):
            parsed = parse_decimal_co(m.group(1))
            if parsed is None:
                continue
            if abs(parsed - amt) <= 0.009:
                return True

        return False

    # flatten a few key fields
    def check_field(path: str, value: Optional[str]):
        if value is None:
            confs[path] = 0.0
            return None
        v = str(value).strip()
        if not v:
            confs[path] = 0.0
            return None
        v_norm = normalize_text_for_match(v)
        ok = v_norm in text_norm
        if not ok and path.startswith("monetary."):
            ok = _money_value_in_text(text_raw, v)
        if not ok:
            warnings.append(f"Sin evidencia textual para {path}; se anuló")
            confs[path] = 0.2
            return None
        confs[path] = 0.8
        return value

    vendor = structured.get("vendor") if isinstance(structured.get("vendor"), dict) else {}
    invoice = structured.get("invoice") if isinstance(structured.get("invoice"), dict) else {}
    dian = structured.get("dian") if isinstance(structured.get("dian"), dict) else {}
    monetary = structured.get("monetary") if isinstance(structured.get("monetary"), dict) else {}

    vendor["nit"] = check_field("vendor.nit", vendor.get("nit"))
    invoice["number"] = check_field("invoice.number", invoice.get("number"))
    invoice["cufe"] = check_field("invoice.cufe", invoice.get("cufe"))
    dian["cufe"] = check_field("dian.cufe", dian.get("cufe"))
    monetary["total"] = check_field("monetary.total", monetary.get("total"))

    structured["vendor"] = vendor
    structured["invoice"] = invoice
    structured["dian"] = dian
    structured["monetary"] = monetary

    return structured, confs, warnings


def compute_capture_percent(page_confs: List[float], field_confs: Dict[str, float], structured: Optional[Dict[str, Any]] = None) -> int:
    """Score 0..100 de "captación" (qué tan usable quedó la extracción).

    - No es solo calidad OCR: pondera más la completitud de campos clave.
    - Usa evidencia (no-hallucination) como señal adicional.
    """

    def clamp01(x: float) -> float:
        return max(0.0, min(1.0, x))

    def is_present(value: Any) -> bool:
        if value is None:
            return False
        if isinstance(value, (int, float)):
            return True
        s = str(value).strip()
        return bool(s) and s.lower() not in ("null", "none", "nan")

    # OCR quality: promedio de conf (0..100)
    ocr_vals = [float(c) for c in (page_confs or []) if c and float(c) > 0]
    ocr_score = clamp01((sum(ocr_vals) / len(ocr_vals)) / 100.0) if ocr_vals else 0.0

    # Evidence confidence: promedio 0..1
    ev_vals = [float(v) for v in (field_confs or {}).values() if v is not None]
    evidence_score = clamp01(sum(ev_vals) / len(ev_vals)) if ev_vals else 0.0

    # Field completeness
    required_paths = [
        "vendor.nit",
        "invoice.number",
        "invoice.date",
        "monetary.total",
    ]
    optional_paths = [
        "vendor.name",
        "customer.nit",
        "customer.name",
        "invoice.dueDate",
        "dian.cufe",
        "dian.resolutionNumber",
        "monetary.subtotal",
        "monetary.taxTotal",
        "monetary.withholdingTotal",
        "payment.method",
    ]

    present_required = 0
    present_optional = 0

    if isinstance(structured, dict):
        for p in required_paths:
            if is_present(_get_by_path(structured, p)):
                present_required += 1
        for p in optional_paths:
            if is_present(_get_by_path(structured, p)):
                present_optional += 1

    required_ratio = present_required / max(1, len(required_paths))
    optional_ratio = present_optional / max(1, len(optional_paths))
    field_score = (0.75 * required_ratio) + (0.25 * optional_ratio)

    # Mezcla final (prioriza completitud real). Ajustable.
    final_score = (0.60 * field_score) + (0.25 * evidence_score) + (0.15 * ocr_score)
    return int(max(0, min(100, round(final_score * 100))))


def extract_candidates(text: str) -> Dict[str, List[str]]:
    t = text or ""
    candidates: Dict[str, List[str]] = {
        "nit": [],
        "totals": [],
        "dates": [],
    }

    for m in re.finditer(r"\b\d{6,11}\s*[-–]\s*\d\b", t):
        candidates["nit"].append(m.group(0))

    for m in re.finditer(r"\b(\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d{2})?)\b", t):
        candidates["totals"].append(m.group(1))

    for m in re.finditer(r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b", t):
        candidates["dates"].append(m.group(1))

    return candidates


def compare_ocr(paddle_text: str, tesseract_text: str) -> List[Dict[str, Any]]:
    issues: List[Dict[str, Any]] = []
    p = extract_candidates(paddle_text)
    t = extract_candidates(tesseract_text)

    # NIT
    if p["nit"] and t["nit"]:
        if p["nit"][0].replace(" ", "") != t["nit"][0].replace(" ", ""):
            issues.append({
                "code": "OCR_NIT_MISMATCH",
                "message": "PaddleOCR y Tesseract difieren en el NIT candidato",
                "severity": "MEDIUM",
                "paddle": p["nit"][0],
                "tesseract": t["nit"][0],
            })

    # Totales (heurística: comparar máximo monto detectado)
    def max_money(vals: List[str]) -> Optional[float]:
        parsed = [parse_decimal_co(v) for v in vals]
        parsed = [x for x in parsed if x is not None]
        return max(parsed) if parsed else None

    p_max = max_money(p["totals"])
    t_max = max_money(t["totals"])
    if p_max is not None and t_max is not None:
        if abs(p_max - t_max) > 2.0:
            issues.append({
                "code": "OCR_TOTAL_MISMATCH",
                "message": "PaddleOCR y Tesseract difieren en el total candidato",
                "severity": "MEDIUM",
                "paddle": p_max,
                "tesseract": t_max,
            })

    return issues


@app.get("/health")
def health():
    return {
        "ok": True,
        "ts": int(time.time()),
        "providers": {
            "tesseract": _is_tesseract_available(),
            # PaddleOCR requiere `paddle`; aquí solo indicamos disponibilidad del módulo.
            "paddle": bool(__import__("importlib").util.find_spec("paddle")),
        },
    }


@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    document_type: str = Form("FACTURA"),
    country: str = Form("CO"),
    language: str = Form("es"),
    provider: Optional[str] = Form(None),
    use_llm: str = Form("true"),
    x_api_key: Optional[str] = Header(None),
):
    _require_api_key(x_api_key)

    mime_type = file.content_type or "application/octet-stream"
    file_bytes = await file.read()

    # PDFs "nativos" pueden tener texto embebido. Si está disponible, es MUCHO más confiable que OCR.
    pdf_text = ""
    pdf_text_pages: List[Dict[str, Any]] = []
    if mime_type == "application/pdf":
        pdf_text, pdf_text_pages = extract_pdf_text_pymupdf(file_bytes)

    pages = load_pages(file_bytes, mime_type)

    page_results: List[Dict[str, Any]] = []
    page_confs: List[float] = []
    layouts: List[Dict[str, Any]] = []

    # Preferimos PaddleOCR cuando está disponible (mejor en fotos/escaneos). Siempre hay fallback a Tesseract.
    provider_req = (provider or "PADDLEOCR").strip().upper()
    use_paddle = provider_req == "PADDLEOCR"
    provider_effective = "PADDLEOCR" if use_paddle else "TESSERACT"
    ocr_warnings: List[str] = []

    # Verificar disponibilidad de paddle antes del bucle
    if use_paddle and importlib.util.find_spec("paddle") is None:
        ocr_warnings.append("PaddleOCR no disponible (módulo 'paddle' no instalado). Usando Tesseract.")
        use_paddle = False
        provider_effective = "TESSERACT"

    for img in pages:
        bgr = pil_to_bgr(img)
        pre = preprocess_bgr(bgr)
        # Mantener variante binarizada para posibles diagnósticos/uso futuro.
        _pre_bgr = cv2.cvtColor(pre, cv2.COLOR_GRAY2BGR)

        # Provider selection:
        # - Si provider=TESSERACT: solo Tesseract.
        # - Si provider=PADDLEOCR (default): intentar PaddleOCR y hacer fallback a Tesseract si falla.
        paddle: Optional[Dict[str, Any]] = None
        if use_paddle:
            try:
                # PaddleOCR suele rendir mejor con la imagen original (no umbralizada).
                paddle = paddle_ocr_page(bgr, language)
            except Exception as e:
                # Si Paddle no está disponible (ej: falta 'paddle'), no abortamos el escaneo.
                ocr_warnings.append(f"PaddleOCR no disponible, usando Tesseract. Detalle: {e}")
                use_paddle = False
                provider_effective = "TESSERACT"
                paddle = None

        tess: Optional[Dict[str, Any]] = None
        try:
            logger.info(f"[DEBUG] Llamando a tesseract_ocr_page con language={language}")
            # Importante: pasar imagen original (no binarizada). Tesseract hará sus propios intentos.
            tess = tesseract_ocr_page(bgr, language)
            logger.info("[DEBUG] tesseract_ocr_page completado exitosamente")
        except Exception as e:
            logger.error(f"[DEBUG] Error en tesseract_ocr_page: {type(e).__name__}: {e}")
            ocr_warnings.append(f"Tesseract no disponible. Detalle: {e}")
            tess = None

        logger.info(f"[DEBUG] provider_effective={provider_effective}, tess={tess is not None}")
        if provider_effective == "TESSERACT" and tess is None:
            logger.error("[DEBUG] Lanzando HTTPException 503")
            raise HTTPException(status_code=503, detail=_tesseract_install_help())

        if provider_effective != "TESSERACT" and paddle is None and tess is None:
            raise HTTPException(
                status_code=503,
                detail=(
                    "No hay motor OCR disponible en el servidor. "
                    "PaddleOCR requiere instalar paddlepaddle (módulo 'paddle') y/o "
                    "Tesseract requiere instalar el binario tesseract.exe."
                ),
            )

        layout = detect_layout((paddle or {}).get("lines", []) or [], int(img.size[0]), int(img.size[1]))
        layouts.append(layout)

        page_results.append({
            "paddle": paddle,
            "tesseract": tess,
            "width": int(img.size[0]),
            "height": int(img.size[1]),
            "layout": layout,
        })

        # Normalize confidences to 0..100
        tess_c = float((tess or {}).get("avgConfidence", 0.0))
        if paddle is not None and provider_effective != "TESSERACT":
            paddle_c = float((paddle.get("avgConfidence", 0.0) or 0.0) * 100.0)
            page_confs.append((paddle_c + tess_c) / 2.0)
        else:
            page_confs.append(tess_c)

    if provider_effective == "TESSERACT":
        extracted_text = "\n\n".join([
            ((p.get("tesseract") or {}).get("text") or "").strip() for p in page_results
        ]).strip()
    else:
        extracted_text = "\n\n".join([
            ((p.get("paddle") or {}).get("text") or "").strip() for p in page_results
        ]).strip()

    tesseract_text = "\n\n".join([
        ((p.get("tesseract") or {}).get("text") or "").strip() for p in page_results
    ]).strip()

    ocr_diagnostics: List[Dict[str, Any]] = []
    if provider_effective != "TESSERACT":
        ocr_diagnostics = compare_ocr(extracted_text, tesseract_text)

    # Preferir texto embebido del PDF (si parece usable) para clasificación/extracción.
    text_source = "OCR"
    if mime_type == "application/pdf" and pdf_text:
        pdf_quality = _text_quality(pdf_text)
        ocr_diagnostics.append({
            "code": "PDF_TEXT_EXTRACT",
            "message": "Texto embebido del PDF extraído con PyMuPDF",
            "severity": "INFO",
            "quality": pdf_quality,
            "pages": pdf_text_pages,
        })
        if _is_usable_text(pdf_text):
            extracted_text = pdf_text.strip()
            text_source = "PDF_TEXT"
        else:
            # Si hay texto pero es poco/ruidoso, lo anexamos para dar más contexto sin reemplazar OCR.
            extracted_text = (extracted_text + "\n\n" + pdf_text).strip()
            text_source = "OCR+PDF_TEXT"

    llm_enabled = str(use_llm).lower() not in ("0", "false", "no")
    layout_hint = {
        "pageCount": len(pages),
        "pages": layouts,
    }

    # Clasificación (auto-detect) a partir del texto OCR.
    requested_type = (document_type or "").strip().upper() or "FACTURA"
    detected_type, detected_conf, detected_evidence = detect_document_type_co(extracted_text)
    effective_type = detected_type if requested_type in ("AUTO", "DETECT", "AUTODETECT") else requested_type

    llm = (
        await llm_extract_invoice(extracted_text, layout_hint=layout_hint)
        if llm_enabled
        else {"llmUsed": False, "structured": None, "fieldConfidences": {}, "warnings": ["LLM deshabilitado"]}
    )
    structured = llm.get("structured") if isinstance(llm, dict) else None

    # Fallback heurístico cuando no hay LLM o no devolvió estructura.
    if not isinstance(structured, dict):
        if effective_type in ("PAGO", "RECIBO"):
            structured = heuristic_extract_structured_co_payment(extracted_text)
        else:
            structured = heuristic_extract_structured_co_invoice(extracted_text)

    structured, evidence_confs, evidence_warnings = enforce_no_hallucination(extracted_text, structured)

    evidence_snippets = build_evidence_snippets(extracted_text, structured) if isinstance(structured, dict) else {}
    highlights = build_highlights_from_tesseract(page_results, structured) if isinstance(structured, dict) else {}

    validations = validate_invoice_rules(structured) if isinstance(structured, dict) else []

    capture_percent = compute_capture_percent(page_confs, evidence_confs, structured if isinstance(structured, dict) else None)

    return {
        "provider": provider_effective,
        "pageCount": len(pages),
        "capturePercent": capture_percent,
        "extractedText": extracted_text,
        "extractedData": {
            "textSource": text_source,
            "documentType": effective_type,
            "classification": {
                "requested": requested_type,
                "detected": detected_type,
                "confidence": float(detected_conf),
                "evidence": detected_evidence,
            },
            "country": country,
            "language": language,
            "ocr": {
                "pages": page_results,
                "pageConfidences": page_confs,
            },
            "ocrWarnings": ocr_warnings,
            "layout": layout_hint,
            "semantic": {
                "llmUsed": llm.get("llmUsed") if isinstance(llm, dict) else False,
                "structured": structured,
                "fieldConfidences": evidence_confs,
                "evidenceSnippets": evidence_snippets,
                "highlights": highlights,
                "warnings": (llm.get("warnings") if isinstance(llm, dict) else []) + evidence_warnings,
            },
            "ocrDiagnostics": ocr_diagnostics,
            "validations": validations,
        },
    }


@app.post("/extract-email-lead")
async def extract_email_lead(
    request: Request,
    x_api_key: Optional[str] = Header(None),
):
    _require_api_key(x_api_key)

    try:
        body = await request.json()
    except Exception:
        body = None
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Body JSON inválido")

    extracted_text = str(body.get("text") or body.get("bodyText") or "").strip()
    metadata = {
        "subject": str(body.get("subject") or "").strip(),
        "fromName": str(body.get("fromName") or "").strip(),
        "fromAddress": str(body.get("fromAddress") or "").strip().lower(),
        "phone": str(body.get("phone") or "").strip(),
        "company": str(body.get("company") or "").strip(),
        "city": str(body.get("city") or "").strip(),
    }
    if not extracted_text and not metadata["subject"]:
        raise HTTPException(status_code=400, detail="Se requiere texto o subject para extraer el lead")

    llm_enabled = str(body.get("use_llm", "true")).lower() not in ("0", "false", "no")
    llm = (
        await llm_extract_email_lead(extracted_text, metadata=metadata)
        if llm_enabled
        else {"llmUsed": False, "structured": None, "fieldConfidences": {}, "warnings": ["LLM deshabilitado"]}
    )
    structured = llm.get("structured") if isinstance(llm, dict) else None

    if not isinstance(structured, dict):
        structured = heuristic_extract_email_lead(extracted_text, metadata=metadata)

    structured, field_confs, warnings = enforce_no_hallucination_email_lead(extracted_text, structured, metadata=metadata)
    evidence_snippets = build_email_lead_evidence_snippets(extracted_text, structured) if isinstance(structured, dict) else {}
    capture_percent = compute_text_capture_percent(field_confs, structured)

    return {
        "capturePercent": capture_percent,
        "extractedData": {
            "contact": (structured or {}).get("contact") if isinstance(structured, dict) else {},
            "request": (structured or {}).get("request") if isinstance(structured, dict) else {},
            "semantic": {
                "llmUsed": llm.get("llmUsed") if isinstance(llm, dict) else False,
                "structured": structured,
                "fieldConfidences": field_confs,
                "evidenceSnippets": evidence_snippets,
                "warnings": (llm.get("warnings") if isinstance(llm, dict) else []) + warnings,
            },
        },
    }
