"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, ChefHat, Package2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  aggregateRestaurantSaleStockItems,
  createEmptyRestaurantBoard,
  type Recipe,
  type RecipeComponent,
  type RecipeComponentUsageScope,
  RESTAURANT_STATION_OPTIONS,
  recipeComponentAppliesToServiceMode,
  type RestaurantBoardState,
  type RestaurantBoardSummary,
  type RestaurantServiceMode,
  type Station,
} from "@/lib/restaurante";

type OverviewData = {
  sede: { id: string; nombre: string };
  currentTurno: {
    id: string;
    title: string | null;
    status: "ABIERTO" | "CERRADO";
    board: RestaurantBoardState;
    summary: RestaurantBoardSummary;
    updatedAt: string;
  } | null;
  materials: Array<{
    id: string;
    nombre: string;
    categoria: string | null;
    unidadMedida: string;
    stockActual: number;
    stockMinimo: number;
    precioCompra: number | null;
    precioUnidad: number | null;
    wastePct: number;
  }>;
};

type RecipeDraftState = {
  recipeId: string | null;
  name: string;
  station: Station;
  yieldCount: number;
  notes: string;
  components: RecipeComponent[];
};

type SaveState = "idle" | "saving" | "saved" | "error";

function createRecipeDraft(): RecipeDraftState {
  return {
    recipeId: null,
    name: "",
    station: "COCINA",
    yieldCount: 1,
    notes: "",
    components: [{ id: crypto.randomUUID(), materialId: "", quantity: 1, usageScope: "ALL" }],
  };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(value || 0);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Sin guardar";
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatUsageScopeLabel(value: RecipeComponentUsageScope) {
  if (value === "DINE_IN") return "Solo mesa";
  if (value === "TAKEAWAY") return "Solo para llevar";
  if (value === "DELIVERY") return "Solo domicilio";
  if (value === "OFF_PREMISE") return "Para llevar y domicilio";
  return "Siempre";
}

export default function IngredientesRestauranteClient() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [board, setBoard] = useState<RestaurantBoardState>(createEmptyRestaurantBoard);
  const [currentTurnoId, setCurrentTurnoId] = useState<string | null>(null);
  const [recipeDraft, setRecipeDraft] = useState<RecipeDraftState>(createRecipeDraft);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/restaurante/overview", { cache: "no-store" });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error ?? "No se pudo cargar el submódulo de ingredientes.");
        }
        if (cancelled) return;
        const data = payload.data as OverviewData;
        setOverview(data);
        setBoard(data.currentTurno?.board ?? createEmptyRestaurantBoard());
        setCurrentTurnoId(data.currentTurno?.id ?? null);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el submódulo de ingredientes.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadOverview();
    return () => {
      cancelled = true;
    };
  }, []);

  async function persistBoard(nextBoard: RestaurantBoardState) {
    setSaveState("saving");
    setError(null);
    const response = await fetch("/api/restaurante/turnos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: currentTurnoId, action: "SAVE", board: nextBoard }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      setSaveState("error");
      throw new Error(payload?.error ?? "No se pudo guardar la receta.");
    }
    setSaveState("saved");
    setCurrentTurnoId(payload.data?.id ?? null);
    setBoard(payload.data?.board ?? nextBoard);
    setOverview((current) =>
      current
        ? {
            ...current,
            currentTurno: payload.data,
          }
        : current,
    );
  }

  function startRecipeEdit(recipe: Recipe) {
    setRecipeDraft({
      recipeId: recipe.id,
      name: recipe.name,
      station: recipe.station,
      yieldCount: recipe.yieldCount,
      notes: recipe.notes,
      components: recipe.components.map((component) => ({ ...component })),
    });
  }

  async function saveRecipe() {
    const validComponents = recipeDraft.components.filter((component) => component.materialId && component.quantity > 0);
    if (!recipeDraft.name.trim() || !validComponents.length) {
      setError("Escribe el nombre de la receta y al menos un insumo válido.");
      return;
    }

    const nextBoard: RestaurantBoardState = {
      ...board,
      recipes: recipeDraft.recipeId
        ? board.recipes.map((recipe) =>
            recipe.id === recipeDraft.recipeId
              ? {
                  ...recipe,
                  name: recipeDraft.name.trim(),
                  station: recipeDraft.station,
                  yieldCount: Math.max(1, Number(recipeDraft.yieldCount) || 1),
                  notes: recipeDraft.notes.trim(),
                  components: validComponents,
                }
              : recipe,
          )
        : [
            {
              id: crypto.randomUUID(),
              name: recipeDraft.name.trim(),
              station: recipeDraft.station,
              yieldCount: Math.max(1, Number(recipeDraft.yieldCount) || 1),
              notes: recipeDraft.notes.trim(),
              components: validComponents,
            },
            ...board.recipes,
          ],
    };

    try {
      await persistBoard(nextBoard);
      setRecipeDraft(createRecipeDraft());
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar la receta.");
    }
  }

  async function deleteRecipe(recipeId: string) {
    const nextBoard: RestaurantBoardState = {
      ...board,
      recipes: board.recipes.filter((recipe) => recipe.id !== recipeId),
    };
    try {
      await persistBoard(nextBoard);
      if (recipeDraft.recipeId === recipeId) setRecipeDraft(createRecipeDraft());
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo borrar la receta.");
    }
  }

  function updateComponent(componentId: string, changes: Partial<RecipeComponent>) {
    setRecipeDraft((current) => ({
      ...current,
      components: current.components.map((component) => (component.id === componentId ? { ...component, ...changes } : component)),
    }));
  }

  const materialsById = useMemo(() => new Map((overview?.materials ?? []).map((material) => [material.id, material])), [overview?.materials]);

  const projectedTurnConsumption = useMemo(() => {
    const recipesById = new Map(board.recipes.map((recipe) => [recipe.id, recipe]));
    const stockItems: Array<{ materialId: string; quantity: number }> = [];

    for (const table of board.tables) {
      for (const ticket of table.tickets) {
        if (!ticket.recipeId) continue;
        const recipe = recipesById.get(ticket.recipeId);
        if (!recipe) continue;
        for (const component of recipe.components) {
          if (!component.materialId || component.quantity <= 0) continue;
          if (!recipeComponentAppliesToServiceMode(component, table.serviceMode)) continue;
          stockItems.push({
            materialId: component.materialId,
            quantity: (component.quantity * ticket.qty) / Math.max(recipe.yieldCount, 1),
          });
        }
      }
    }

    return aggregateRestaurantSaleStockItems(stockItems)
      .map((item) => {
        const material = materialsById.get(item.materialId);
        if (!material) return null;
        return {
          ...item,
          nombre: material.nombre,
          unidad: material.unidadMedida,
          projectedStock: material.stockActual - item.quantity,
        };
      })
      .filter(Boolean)
      .sort((left, right) => right!.quantity - left!.quantity);
  }, [board.recipes, board.tables, materialsById]);

  const saveLabel =
    saveState === "saving"
      ? "Guardando..."
      : saveState === "saved"
        ? `Guardado ${formatDateTime(overview?.currentTurno?.updatedAt)}`
        : saveState === "error"
          ? "Error al guardar"
          : currentTurnoId
            ? `Turno activo ${formatDateTime(overview?.currentTurno?.updatedAt)}`
            : "Aún sin turno persistido";

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Cargando recetas e insumos del vertical restaurante...</div>;
  }

  return (
    <div className="min-h-full bg-[linear-gradient(180deg,#fff7ed_0%,#ffffff_24%,#f8fafc_100%)] p-4 lg:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[32px] border border-orange-100 bg-white/90 p-6 shadow-[0_30px_80px_-48px_rgba(249,115,22,0.35)] backdrop-blur">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                <Link href="/dashboard" className="transition hover:text-orange-600">Dashboard</Link>
                <ChevronRight className="h-4 w-4" />
                <Link href="/dashboard/restaurante" className="transition hover:text-orange-600">Restaurante</Link>
                <ChevronRight className="h-4 w-4" />
                <span className="text-orange-600">Ingredientes y recetas</span>
              </div>
              <div className="mt-4 flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-orange-500 text-white shadow-[0_18px_36px_-24px_rgba(249,115,22,0.9)]">
                  <Package2 className="h-7 w-7" />
                </div>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Submódulo de ingredientes</h1>
                  <p className="mt-1 text-sm text-slate-500">Recetas finales, insumos base, empaques por modo de servicio y consumo del turno.</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline" className="rounded-2xl">
                <Link href="/dashboard/restaurante">Volver a cabina</Link>
              </Button>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-[24px] border border-orange-100 bg-orange-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">Recetas activas</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{board.recipes.length}</div>
              <div className="text-xs text-slate-500">Vinculadas al mismo turno del restaurante.</div>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Insumos vigilados</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{overview?.materials.length ?? 0}</div>
              <div className="text-xs text-slate-500">Stock actual y mínimo operativo por producto base.</div>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Estado</div>
              <div className="mt-2 text-lg font-semibold text-slate-950">{saveLabel}</div>
              <div className="text-xs text-slate-500">Sede: {overview?.sede.nombre ?? "Actual"}</div>
            </div>
          </div>
        </header>

        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
          <section className="space-y-4 rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Receta final</h2>
                <p className="text-sm text-slate-500">Define el producto final y qué ingredientes o empaques consume según el canal.</p>
              </div>
              {recipeDraft.recipeId ? (
                <Button type="button" variant="ghost" onClick={() => setRecipeDraft(createRecipeDraft())}>Cancelar edición</Button>
              ) : null}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-slate-600">Producto final</span>
                <Input value={recipeDraft.name} onChange={(event) => setRecipeDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Capuchino 16 oz" />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-600">Estación</span>
                <Select value={recipeDraft.station} onValueChange={(value) => setRecipeDraft((current) => ({ ...current, station: value as Station }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RESTAURANT_STATION_OPTIONS.map((station) => (
                      <SelectItem key={station} value={station}>{station}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-600">Rinde</span>
                <Input type="number" min={1} value={recipeDraft.yieldCount} onChange={(event) => setRecipeDraft((current) => ({ ...current, yieldCount: Number(event.target.value) || 1 }))} />
              </label>
              <label className="space-y-1 text-sm lg:col-span-2">
                <span className="text-slate-600">Notas</span>
                <Textarea value={recipeDraft.notes} onChange={(event) => setRecipeDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Preparación, merma o aclaraciones del servicio" className="min-h-[88px]" />
              </label>
            </div>

            <div className="space-y-3">
              {recipeDraft.components.map((component) => (
                <div key={component.id} className="grid gap-2 rounded-[22px] border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[minmax(0,1fr)_120px_220px_auto]">
                  <Select value={component.materialId || "__none__"} onValueChange={(value) => updateComponent(component.id, { materialId: value === "__none__" ? "" : value })}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Insumo base" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Selecciona insumo</SelectItem>
                      {(overview?.materials ?? []).map((material) => (
                        <SelectItem key={material.id} value={material.id}>{material.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="number" min={0.01} step={0.01} value={component.quantity} onChange={(event) => updateComponent(component.id, { quantity: Number(event.target.value) || 0 })} />
                  <Select value={component.usageScope} onValueChange={(value) => updateComponent(component.id, { usageScope: value as RecipeComponentUsageScope })}>
                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Siempre</SelectItem>
                      <SelectItem value="DINE_IN">Solo mesa</SelectItem>
                      <SelectItem value="TAKEAWAY">Solo para llevar</SelectItem>
                      <SelectItem value="DELIVERY">Solo domicilio</SelectItem>
                      <SelectItem value="OFF_PREMISE">Para llevar y domicilio</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="ghost" onClick={() => setRecipeDraft((current) => ({ ...current, components: current.components.length === 1 ? current.components : current.components.filter((item) => item.id !== component.id) }))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={() => setRecipeDraft((current) => ({ ...current, components: [...current.components, { id: crypto.randomUUID(), materialId: "", quantity: 1, usageScope: "ALL" }] }))}>
                <Plus className="mr-2 h-4 w-4" /> Agregar insumo
              </Button>
              <Button type="button" className="bg-orange-500 text-white hover:bg-orange-600" onClick={() => void saveRecipe()}>
                <Save className="mr-2 h-4 w-4" /> {recipeDraft.recipeId ? "Actualizar receta" : "Guardar receta"}
              </Button>
            </div>
          </section>

          <section className="space-y-4 rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Consumo proyectado del turno</h2>
              <p className="text-sm text-slate-500">Toma las comandas activas del vertical restaurante y calcula el impacto real sobre stock.</p>
            </div>
            <div className="space-y-3">
              {projectedTurnConsumption.length ? (
                projectedTurnConsumption.map((item) => (
                  <div key={item!.materialId} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-950">{item!.nombre}</div>
                        <div className="text-xs text-slate-500">Consumo proyectado: {formatNumber(item!.quantity)} {item!.unidad}</div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="font-semibold text-slate-950">Stock proyectado {formatNumber(item!.projectedStock)}</div>
                        <div className={item!.projectedStock <= 0 ? "text-rose-600" : item!.projectedStock <= 5 ? "text-amber-600" : "text-emerald-600"}>
                          {item!.projectedStock <= 0 ? "Queda agotado" : item!.projectedStock <= 5 ? "Queda bajo" : "Cobertura normal"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[22px] border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">El consumo aparecerá cuando existan comandas ligadas a recetas en restaurante.</div>
              )}
            </div>
          </section>
        </div>

        <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Recetas guardadas</h2>
              <p className="text-sm text-slate-500">Cada receta final puede llevar ingredientes distintos para mesa, para llevar o domicilio.</p>
            </div>
            <div className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">Vertical restaurante</div>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {board.recipes.length ? (
              board.recipes.map((recipe) => {
                const estimatedCost = recipe.components.reduce((sum, component) => {
                  const material = materialsById.get(component.materialId);
                  const unitCost = material?.precioUnidad ?? material?.precioCompra ?? 0;
                  return sum + unitCost * component.quantity;
                }, 0);
                return (
                  <div key={recipe.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-slate-950">
                          <ChefHat className="h-4 w-4 text-orange-500" />
                          <span className="font-semibold">{recipe.name}</span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{recipe.station} · rinde {recipe.yieldCount} · costo base {formatCurrency(estimatedCost)}</div>
                      </div>
                      <div className="flex gap-1">
                        <Button type="button" variant="ghost" onClick={() => startRecipeEdit(recipe)}><Pencil className="h-4 w-4" /></Button>
                        <Button type="button" variant="ghost" onClick={() => void deleteRecipe(recipe.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    {recipe.notes ? <div className="mt-3 text-sm text-slate-600">{recipe.notes}</div> : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {recipe.components.map((component) => {
                        const material = materialsById.get(component.materialId);
                        return (
                          <span key={component.id} className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-slate-600 shadow-sm">
                            {material?.nombre ?? "Insumo"} · {formatNumber(component.quantity)} {material?.unidadMedida ?? ""} · {formatUsageScopeLabel(component.usageScope)}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-[22px] border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">Aún no hay recetas. Crea aquí las bebidas, platos o combos finales con sus ingredientes base.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
