# Tutorial De Uso: Cotizacion Y Flujo Litografico

## Objetivo

Este documento explica el flujo completo para construir una cotizacion usable en operacion diaria:

1. crear o validar el producto/material
2. crear el cliente
3. definir o ajustar stock
4. construir la cotizacion
5. agregar items litograficos
6. revisar costos, margen, PDF y entrega

Tambien incluye dos ejemplos didacticos:

1. 1000 afiches doble cara
2. cartilla/revista/libro de 20 paginas con portada tamano carta plastificada

## Alcance Real Del Sistema

Rutas principales del flujo:

1. /dashboard/materiales
2. /dashboard/clientes
3. /dashboard/inventario
4. /dashboard/litografia
5. /dashboard/cotizador
6. /dashboard/cotizaciones

El modulo litografico no trabaja solo como una lista de precios fija. Su resultado depende de lo que este cargado en configuracion litografica:

1. perfiles de plancha
2. perfiles de tinta
3. papeles
4. acabados
5. tamanos

Si esos datos no estan bien configurados, la cotizacion puede abrir, pero el costo final no sera confiable.

## Mapa Del Flujo

Orden recomendado para capacitar a un usuario nuevo:

1. crear cliente
2. crear material o producto base si aplica
3. definir stock inicial o bodega
4. validar tarifario litografico
5. abrir cotizador
6. agregar item comun o item litografico
7. guardar cotizacion
8. previsualizar PDF
9. enviar o descargar

## Paso 1: Crear Cliente

Ruta: /dashboard/clientes

Que se registra normalmente:

1. nombre
2. tipo de documento
3. documento
4. email
5. telefono o celular
6. direccion
7. ciudad y departamento
8. segmento si el equipo comercial lo usa

Buenas practicas:

1. usar un nombre facil de encontrar en el buscador del cotizador
2. validar telefono y email antes de guardar
3. si el cliente ya existe, editarlo en vez de duplicarlo

Resultado esperado:

1. el cliente queda disponible para seleccion en /dashboard/cotizador
2. tambien puede quedar precargado desde CRM cuando el flujo arranca desde una oportunidad

## Paso 2: Crear Material O Producto

Ruta: /dashboard/materiales

Este modulo sirve para el catalogo general, no solo para litografia. Ahi se registran insumos, referencias vendibles y productos personalizados segun el tipo de negocio.

Campos que normalmente importan para cotizacion:

1. nombre
2. tipo
3. categoria
4. unidad de medida: m2, ml o unidad
5. precio de compra o precio unitario
6. stock actual y stock minimo
7. proveedor
8. observaciones

Cuando conviene crear material:

1. cuando el item se vende de forma repetitiva
2. cuando se necesita control de stock
3. cuando se desea reutilizar el mismo insumo en varias cotizaciones

Cuando no hace falta crear material antes:

1. cuando el item se va a cotizar directamente desde el dialogo de litografia
2. cuando el costo depende mas del armado tecnico que de una referencia fija

## Paso 3: Definir Stock

Ruta: /dashboard/inventario

El inventario permite registrar movimientos de entrada, salida y ajuste sobre materiales.

Flujo minimo recomendado:

1. buscar el material
2. abrir el modal de movimiento
3. elegir tipo de movimiento: IN, OUT o ADJUST
4. seleccionar la bodega
5. escribir cantidad
6. agregar nota de soporte
7. guardar

Casos tipicos:

1. IN: llega compra nueva del proveedor
2. OUT: consumo manual o salida operativa
3. ADJUST: correccion de conteo fisico

Buena practica:

1. si el material se usa en varias sedes, confirmar la bodega correcta antes de ajustar cantidades
2. usar la nota para dejar trazabilidad del motivo del movimiento

## Paso 4: Configurar Litografia Antes De Cotizar

Ruta: /dashboard/litografia

Esta pantalla es el centro tecnico del tarifario. Antes de cotizar en serio, revisar:

1. perfiles de plancha
2. perfiles de tinta
3. papeles disponibles
4. acabados especiales
5. formatos y tamanos

Sin esta base, el dialogo litografico no tendra con que calcular bien.

### Que Calcula El Motor Litografico

El calculo base usa esta logica:

1. cantidad base = cantidad solicitada
2. extra = max(cantidad x desperdicioPct, sobranteMinimo)
3. cantidad con desperdicio = cantidad base + extra
4. plancha = costoPlanchaPorColor x numero total de colores
5. tinta = costoTintaPorColor x numero total de colores
6. papel = por unidad o por pliego, segun configuracion
7. costoProduccion = plancha + tinta + papel + corte + acabados + transporte
8. precioVenta = costoProduccion x (1 + margenPct / 100)

Punto clave:

1. el costo de papel por pliego depende de piezasPorPliego y pliegosNecesarios
2. las metricas de hoja de maquina ayudan a operacion, pero no reemplazan el rendimiento del pliego

## Paso 5: Crear La Cotizacion

Ruta: /dashboard/cotizador

Flujo base:

1. seleccionar el cliente
2. escribir descripcion general de la cotizacion
3. agregar items
4. revisar subtotal, IVA y total
5. guardar
6. abrir preview PDF

Tipos de items que se pueden construir:

1. item normal del catalogo
2. item por metraje
3. item litografico

## Paso 6: Agregar Un Item Litografico

Desde /dashboard/cotizador se abre el dialogo de litografia.

El operador debe llenar, como minimo:

1. titulo del item
2. descripcion corta comercial
3. cantidad
4. configuracion de frente y reverso
5. desperdicio
6. papel
7. tamano final
8. planchas
9. tintas
10. corte
11. acabados
12. margen

### Logica De Colores

El sistema guarda frente y reverso por separado, pero el costo termina consolidado en el total de colores necesarios para plancha y tinta.

Ejemplos tipicos:

1. 4/0 = full color solo frente
2. 4/1 = full color frente y una tinta al respaldo
3. 4/4 = full color por ambos lados

### Papel Por Unidad Vs Papel Por Pliego

Usar papel por unidad cuando:

1. la operacion vende piezas simples
2. no se requiere una imposicion tecnica fina
3. se esta haciendo una cotizacion rapida de referencia

Usar papel por pliego cuando:

1. se necesita rendimiento real del pliego
2. importa saber piezas por pliego y pliegos necesarios
3. se quiere una cotizacion mas cercana a produccion

## Caso 1: Ejemplo Didactico De 1000 Afiches Doble Cara

Objetivo del ejemplo: mostrar como se arma un item litografico de pieza suelta.

### Supuestos Del Ejemplo

Estos valores son didacticos. No son una promesa comercial universal. En produccion real se deben reemplazar por el tarifario cargado en /dashboard/litografia.

Supuestos:

1. cantidad solicitada: 1000
2. tamano final: 50 x 70 cm
3. impresion: 4/4
4. numero total de colores modelados: 8
5. desperdicio: 5%
6. sobrante minimo: 100
7. papel modo: pliego
8. pliego: 70 x 100 cm
9. costo por pliego: 6500 COP
10. corte: 50000 COP
11. acabados: 0 COP
12. transporte: 20000 COP
13. costo plancha por color: 20000 COP
14. costo tinta por color: 8000 COP
15. margen: 35%

### Desarrollo Del Calculo

1. extra por desperdicio = 1000 x 5% = 50
2. se compara contra sobrante minimo = 100
3. extra aplicado = 100
4. cantidad con desperdicio = 1100
5. en un pliego 70 x 100 caben 2 afiches 50 x 70
6. pliegos necesarios = 1100 / 2 = 550
7. costo papel = 550 x 6500 = 3575000
8. planchas = 8 x 20000 = 160000
9. tinta = 8 x 8000 = 64000
10. corte = 50000
11. transporte = 20000
12. costo de produccion = 3575000 + 160000 + 64000 + 50000 + 20000 = 3869000
13. precio de venta = 3869000 x 1.35 = 5223150
14. precio unitario aproximado = 5223150 / 1000 = 5223.15

### Como Se Carga En El Sistema

1. abrir /dashboard/cotizador
2. seleccionar cliente
3. abrir item litografico
4. escribir titulo: Afiche 50x70 doble cara
5. colocar cantidad: 1000
6. configurar frente 4 y reverso 4
7. activar papel por pliego
8. definir pliego 70 x 100
9. definir formato final 50 x 70
10. cargar costo de pliego o seleccionar el papel configurado
11. revisar plancha, tinta, corte y margen
12. confirmar vista previa de imposicion
13. agregar item

### Que Debe Revisar El Usuario Antes De Guardar

1. que la descripcion comercial si corresponda al producto que vera el cliente
2. que el tamano final no este invertido
3. que el margen no este en cero por error
4. que el precio final si cubra papel, plancha y corte

## Caso 2: Cartilla, Revista O Libro De 20 Paginas Con Portada Carta Plastificada

Objetivo del ejemplo: mostrar el flujo editorial del dialogo litografico.

### Como Trabaja El Flujo Editorial

El dialogo litografico tiene una ruta editorial para:

1. libro
2. cartilla
3. revista

Ese flujo separa:

1. portada
2. internas

Y muestra la imposicion por separado para que el operador entienda como se esta construyendo el costo.

### Supuestos Del Ejemplo

El ejemplo siguiente es didactico y debe reemplazarse por los costos reales del tarifario del negocio.

Supuestos:

1. cantidad: 500 unidades
2. producto: cartilla de 20 paginas
3. tamano final cerrado: carta
4. portada: propalcote, 4/1, plastificado
5. internas: bond, 4/4
6. desperdicio portada: 5%
7. desperdicio internas: 5%
8. sobrante minimo por parte: 100
9. costo plancha por color: 20000 COP
10. costo tinta por color: 8000 COP
11. costo pliego propalcote: 6500 COP
12. costo pliego bond: 4500 COP
13. corte general por parte: 50000 COP
14. transporte general del item: 20000 COP
15. margen final: 35%

### Logica Operativa Del Editorial

Para una cartilla de 20 paginas:

1. la portada se calcula como una parte independiente
2. las internas se calculan como otra parte independiente
3. si el acabado de internas usa compaginado, el sistema multiplica los pliegos internos por unidad automaticamente
4. el costo final del item editorial resulta de sumar portada + internas + acabados asociados

### Desglose Didactico De Portada

Supuestos de portada:

1. frente/reverso = 4/1
2. colores modelados = 5
3. cantidad con extra = 500 + 100 = 600
4. tamano final carta
5. rendimiento didactico del pliego = 6 portadas por pliego

Calculo:

1. pliegos portada = ceil(600 / 6) = 100
2. papel portada = 100 x 6500 = 650000
3. planchas portada = 5 x 20000 = 100000
4. tinta portada = 5 x 8000 = 40000
5. corte portada = 50000
6. plastificado portada = valor configurado en acabados del sistema

Subtotal didactico de portada sin plastificado manual adicional:

1. 650000 + 100000 + 40000 + 50000 = 840000

### Desglose Didactico De Internas

Supuestos de internas:

1. 20 paginas finales equivalen a varios pliegos internos por unidad
2. para explicacion operativa, piense primero en cuantas hojas internas requiere cada cartilla
3. si la interna se arma con compaginado, ese multiplicador lo resuelve el sistema
4. para el ejemplo didactico usaremos 2500 cuerpos internos a imprimir antes de desperdicio

Calculo didactico:

1. base interna = 2500
2. desperdicio 5% = 125, que supera el sobrante minimo de 100
3. total internas con extra = 2625
4. rendimiento didactico del pliego = 6 internas por pliego
5. pliegos internos = ceil(2625 / 6) = 438
6. papel internas = 438 x 4500 = 1971000
7. planchas internas = 8 x 20000 = 160000
8. tinta internas = 8 x 8000 = 64000
9. corte internas = 50000

Subtotal didactico internas:

1. 1971000 + 160000 + 64000 + 50000 = 2245000

### Consolidado Didactico Del Item Editorial

Sin meter aun un valor manual de plastificado, compaginado o encuadernado:

1. portada = 840000
2. internas = 2245000
3. transporte = 20000
4. costo base del item = 3105000
5. precio de venta con 35% = 4191750
6. precio unitario aproximado = 4191750 / 500 = 8383.5

### Como Se Construye En El Sistema

1. abrir el dialogo litografico desde /dashboard/cotizador
2. entrar al flujo editorial
3. elegir si el producto es libro, cartilla o revista
4. seleccionar formato rapido o tamano personalizado
5. revisar la parte de portada
6. asignar papel de portada
7. asignar impresion frente/reverso de portada
8. agregar plastificado de portada si aplica
9. revisar la parte de internas
10. asignar papel de internas
11. asignar impresion de internas
12. activar el acabado de compaginado si la operacion lo usa
13. revisar el preview de portada por separado
14. revisar el preview de internas por separado
15. validar subtotal y precio de venta
16. agregar item al cotizador

## Que Debe Validar El Supervisor

Antes de aprobar una cotizacion litografica:

1. que el papel seleccionado corresponda al papel real de produccion
2. que frente y reverso no esten invertidos
3. que el desperdicio no sea irrealmente bajo
4. que el sobrante minimo cubra reposicion y control de calidad
5. que los acabados si esten sumando costo
6. que la portada y las internas tengan papeles distintos cuando el producto lo necesita
7. que el margen final este alineado con la politica comercial

## Errores Comunes En Capacitacion

1. cotizar sin haber creado el cliente
2. cargar un item litografico sin validar tamano final
3. dejar el margen en cero
4. usar papel por unidad cuando se necesita costeo por pliego
5. no revisar la diferencia entre portada e internas
6. confundir cantidad de ejemplares con cantidad de cuerpos internos en editorial
7. asumir que el preview tecnico reemplaza la revision comercial del item

## Checklist Rapido Para Operacion

Antes de entregar una cotizacion:

1. cliente correcto
2. descripcion entendible para el cliente
3. cantidades correctas
4. papel correcto
5. frente/reverso correcto
6. acabados correctos
7. margen correcto
8. PDF revisado
9. total final revisado

## Recomendacion De Capacitacion Interna

Orden de entrenamiento sugerido para nuevos usuarios:

1. dia 1: clientes + materiales + inventario
2. dia 2: cotizador general
3. dia 3: litografia pieza suelta
4. dia 4: litografia editorial
5. dia 5: revision de PDF, envio y correccion de errores comunes

## Nota Final

Las cifras de los ejemplos son de entrenamiento. El valor comercial real debe salir de la configuracion vigente del sistema en /dashboard/litografia y de las decisiones operativas de papel, imposicion, acabados y margen.