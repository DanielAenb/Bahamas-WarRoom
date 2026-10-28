/**
 * Bahamas WarRoom — WorkForce v0.27 para el ClassRoom.
 * Expone window.WareraWorkforce.render(container).
 *
 * Guía práctica en pestañas: Básicos, Contratar, Salarios, Entrenar,
 * Riesgos, Manager y Guía completa.
 */
(function () {
  'use strict';

  const TABS = [
    { id: 'basicos', label: 'Básicos', icon: '🧭' },
    { id: 'contratar', label: 'Contratar', icon: '👥' },
    { id: 'salarios', label: 'Salarios', icon: '💰' },
    { id: 'entrenar', label: 'Entrenar', icon: '🎓' },
    { id: 'riesgos', label: 'Riesgos', icon: '⚠️' },
    { id: 'manager', label: 'Manager', icon: '🧑‍💼' },
    { id: 'guia', label: 'Guía completa', icon: '📖' }
  ];

  const GROUPS = [
    { key: 'herramientas', label: 'Herramientas' },
    { key: 'companeros', label: 'Compañeros' },
    { key: 'trabajo', label: 'Trabajo' },
    { key: 'carrera', label: 'Carrera' },
    { key: 'geografia', label: 'Geografía' },
    { key: 'politica', label: 'Política' },
    { key: 'salarios', label: 'Salarios' },
    { key: 'retencion', label: 'Retención' },
    { key: 'botin', label: 'Botín' },
    { key: 'apoyo', label: 'Apoyo' }
  ];

  const VERDICTS = [
    { key: 'good', label: 'Bueno' },
    { key: 'mixed', label: 'Mixto' },
    { key: 'bad', label: 'Malo' }
  ];

  const TRAITS = [
    {
      name: 'Manitas', nameEn: 'Handy', group: 'herramientas', condition: 'Con una herramienta equipada',
      effect: '+40% de producción', reading: 'Con cualquier herramienta; se acumula con el bonus de la propia herramienta',
      verdict: 'good', weight: 5
    },
    {
      name: 'Improvisador', nameEn: 'Improviser', group: 'herramientas', condition: 'Sin herramienta',
      effect: '+25% de producción', reading: 'Hasta que caiga la primera caja; después Manitas habría sido mejor',
      verdict: 'good', weight: 5
    },
    {
      name: 'Nacionalista', nameEn: 'Nationalist', group: 'companeros', condition: 'Todos los compañeros comparten nacionalidad',
      effect: '+2 de Responsabilidad, +5 de felicidad', reading: 'Tripulación de una sola nación; solo no hace nada',
      verdict: 'good', weight: 10
    },
    {
      name: 'Xenófobo', nameEn: 'Xenophobe', group: 'companeros', condition: 'Un compañero de otra nacionalidad',
      effect: '-2 de Producción, -5 de felicidad', reading: 'Inofensivo solo o en una tripulación de una sola nación',
      verdict: 'bad', weight: 10
    },
    {
      name: 'Cosmopolita', nameEn: 'Cosmopolitan', group: 'companeros', condition: 'Por cada nacionalidad entre los compañeros',
      effect: '+2 de Producción por nacionalidad, hasta +4', reading: 'Necesita una tripulación mixta; solo no hace nada',
      verdict: 'good', weight: 10
    },
    {
      name: 'Solitario', nameEn: 'Loner', group: 'companeros', condition: 'Único empleado',
      effect: '+100% de producción, +5 de felicidad', reading: 'Solo con Break Room 1; se pierde con el primer compañero',
      verdict: 'good', weight: 5
    },
    {
      name: 'Sociable', nameEn: 'Sociable', group: 'companeros', condition: 'Por cada compañero',
      effect: '+25% de producción por compañero hasta +50%, -10 de felicidad si está solo', reading: 'Con Break Room 3 llega a +50%; solo cuesta 10 de felicidad',
      verdict: 'mixed', weight: 10
    },
    {
      name: 'Cómico', nameEn: 'Comic', group: 'companeros', condition: 'Cualquier compañero',
      effect: '-1 de Producción propia, +10 de felicidad a los compañeros', reading: 'Vale la pena en países con impuestos donde la tripulación está cerca de 30',
      verdict: 'mixed', weight: 10
    },
    {
      name: 'Mentor', nameEn: 'Mentor', group: 'companeros', condition: 'Un compañero más débil',
      effect: '+2 de Producción al compañero, -1 de Producción propia', reading: 'Neto +1 de Producción para la tripulación, pero en la otra persona',
      verdict: 'mixed', weight: 2
    },
    {
      name: 'Capataz', nameEn: 'Foreman', group: 'companeros', condition: 'Cualquier compañero',
      effect: '+3 de Responsabilidad a los compañeros', reading: 'Rasgo de tripulación; solo no hace nada',
      verdict: 'good', weight: 5
    },
    {
      name: 'Rival', nameEn: 'Rival', group: 'companeros', condition: 'Un compañero más fuerte',
      effect: '+3 de Producción, -1 si no hay ninguno más fuerte', reading: 'Empareja con un trabajador más fuerte; si no, -1',
      verdict: 'mixed', weight: 5
    },
    {
      name: 'Diva', nameEn: 'Prima donna', group: 'companeros', condition: 'El mejor pagado de la empresa',
      effect: '+20% de producción, -10 de felicidad', reading: '+20% solo mientras sea el mejor pagado; -10 de felicidad siempre',
      verdict: 'mixed', weight: 5
    },
    {
      name: 'Matón', nameEn: 'Bully', group: 'companeros', condition: 'Cualquier compañero',
      effect: '+2 de Producción propia, -10 de felicidad a los compañeros', reading: 'Bien solo; en tripulación los demás pierden 10 de felicidad',
      verdict: 'mixed', weight: 5
    },
    {
      name: 'Envidioso', nameEn: 'Envious', group: 'companeros', condition: 'Por cada compañero mejor pagado',
      effect: '-5 de felicidad cada uno, hasta -10', reading: 'Inofensivo solo o siendo el mejor pagado',
      verdict: 'bad', weight: 10
    },
    {
      name: 'Viejos amigos', nameEn: 'Old friends', group: 'companeros', condition: 'El compañero nombrado está presente',
      effect: '+15% de producción', reading: 'Solo con esa persona en la misma empresa',
      verdict: 'good', weight: 2
    },
    {
      name: 'Némesis', nameEn: 'Nemesis', group: 'companeros', condition: 'El compañero nombrado está presente',
      effect: '-15% de producción', reading: 'Mantén a los dos separados',
      verdict: 'bad', weight: 2
    },
    {
      name: 'Enamorados', nameEn: 'Sweethearts', group: 'companeros', condition: 'El compañero nombrado está presente',
      effect: '+20% de producción', reading: 'Nunca sale al contratar; viene del evento de romance de oficina',
      verdict: 'good', weight: 0
    },
    {
      name: 'Poder femenino', nameEn: 'Girl power', group: 'companeros', condition: 'Por cada compañera',
      effect: '+15% de producción cada una, hasta +30%', reading: 'Necesita compañeras',
      verdict: 'good', weight: 5
    },
    {
      name: 'Hermandad', nameEn: 'Band of brothers', group: 'companeros', condition: 'Por cada compañero',
      effect: '+15% de producción cada uno, hasta +30%', reading: 'Necesita compañeros',
      verdict: 'good', weight: 5
    },
    {
      name: 'Misándrico', nameEn: 'Man hater', group: 'companeros', condition: 'Por cada compañero',
      effect: '-15% de producción cada uno, hasta -30%', reading: 'Inofensivo sin compañeros',
      verdict: 'bad', weight: 5
    },
    {
      name: 'Misógino', nameEn: 'Misogynist', group: 'companeros', condition: 'Por cada compañera',
      effect: '-15% de producción cada una, hasta -30%', reading: 'Inofensivo sin compañeras',
      verdict: 'bad', weight: 5
    },
    {
      name: 'Especialista', nameEn: 'Specialist', group: 'trabajo', condition: 'Produciendo el bien indicado',
      effect: '+3 de Producción, +5 de felicidad', reading: 'Solo en ese bien; cambiar de producto lo pierde',
      verdict: 'good', weight: 10
    },
    {
      name: 'Artesano', nameEn: 'Craftsman', group: 'trabajo', condition: 'Produciendo un producto o arma',
      effect: '+3 de Producción ahí, -1 en materias primas', reading: '+3 en productos y armas, -1 en materias primas',
      verdict: 'mixed', weight: 10
    },
    {
      name: 'Obrero', nameEn: 'Laborer', group: 'trabajo', condition: 'Produciendo una materia prima',
      effect: '+3 de Producción ahí, -1 en el resto', reading: '+3 en materias primas, -1 en productos',
      verdict: 'mixed', weight: 10
    },
    {
      name: 'Aprendiz rápido', nameEn: 'Quick study', group: 'trabajo', condition: 'Siempre',
      effect: 'El bonus por mantener el mismo bien crece el doble de rápido', reading: '+20% a los 10 días en vez de a los 20',
      verdict: 'good', weight: 10
    },
    {
      name: 'Acumulador', nameEn: 'Stockpiler', group: 'trabajo', condition: 'Almacén lleno',
      effect: 'Sin penalización de felicidad por almacén lleno', reading: 'Evita el -10 cuando se llena el almacén',
      verdict: 'good', weight: 10
    },
    {
      name: 'Claustrofóbico', nameEn: 'Claustrophobe', group: 'trabajo', condition: 'Almacén de nivel 2 o menos',
      effect: '-20% de producción', reading: 'Inofensivo desde almacén nivel 3',
      verdict: 'bad', weight: 5
    },
    {
      name: 'Velocista', nameEn: 'Sprinter', group: 'carrera', condition: 'Primeras 24 horas tras llegar',
      effect: '+50% de producción', reading: 'Solo un día',
      verdict: 'good', weight: 5
    },
    {
      name: 'Veterano', nameEn: 'Veteran', group: 'carrera', condition: '30 días de antigüedad',
      effect: '+20% de producción', reading: 'Rinde después de un mes',
      verdict: 'good', weight: 5
    },
    {
      name: 'Rutinario', nameEn: 'Creature of habit', group: 'carrera', condition: 'Mudado en los últimos 3 días',
      effect: '-30% de producción', reading: 'Inofensivo si nunca lo mudas',
      verdict: 'bad', weight: 10
    },
    {
      name: 'Diamante en bruto', nameEn: 'Diamond in the rough', group: 'carrera', condition: 'Por cada 10 días de antigüedad',
      effect: '+1 al atributo indicado, hasta +4', reading: '+4 a los 40 días',
      verdict: 'good', weight: 2
    },
    {
      name: 'Agotado', nameEn: 'Burnout', group: 'carrera', condition: 'Por cada 20 días de antigüedad',
      effect: '-1 a todos los atributos, hasta -3', reading: 'Bien el primer mes; -3 en todo a los 60 días',
      verdict: 'bad', weight: 2
    },
    {
      name: 'Desarrollo tardío', nameEn: 'Late bloomer', group: 'carrera', condition: 'Por cada 10 años por encima de 40',
      effect: '+2 de Producción, hasta +6', reading: 'Uno de 60 años tiene +4, pero se jubila a los 65',
      verdict: 'good', weight: 5
    },
    {
      name: 'Desgastado', nameEn: 'Worn out', group: 'carrera', condition: 'Por cada 10 años por encima de 50',
      effect: '-2 de Producción, hasta -6', reading: 'Inofensivo por debajo de 50; contrata joven',
      verdict: 'bad', weight: 10
    },
    {
      name: 'Patriota', nameEn: 'Patriot', group: 'geografia', condition: 'Empresa en la región core de tu país',
      effect: '+2 de Producción, +10 de felicidad', reading: 'Con el bonus de región core; nada en el extranjero',
      verdict: 'good', weight: 10
    },
    {
      name: 'Nostálgico', nameEn: 'Homesick', group: 'geografia', condition: 'Empresa fuera de tu país',
      effect: '-2 de Producción, -10 de felicidad', reading: 'Inofensivo en casa',
      verdict: 'bad', weight: 10
    },
    {
      name: 'Expatriado', nameEn: 'Expat', group: 'geografia', condition: 'Empresa fuera de tu país',
      effect: '+2 de Producción', reading: 'Solo en el extranjero',
      verdict: 'good', weight: 10
    },
    {
      name: 'Tímido fiscal', nameEn: 'Tax shy', group: 'politica', condition: 'Por cada punto de impuesto sobre la renta',
      effect: '-1% de producción por cada 1% de impuesto, hasta -30%', reading: 'Inofensivo con 0% de impuesto',
      verdict: 'bad', weight: 10
    },
    {
      name: 'Estatista', nameEn: 'Statist', group: 'politica', condition: 'Impuesto sobre la renta del 20% o más',
      effect: '+2 de Responsabilidad', reading: 'Solo en países con impuestos altos',
      verdict: 'good', weight: 10
    },
    {
      name: 'Codicioso', nameEn: 'Greedy', group: 'salarios', condition: 'Siempre',
      effect: 'Pide un 20% más de salario', reading: 'Mismo output, cada hora cuesta una quinta parte más',
      verdict: 'bad', weight: 10
    },
    {
      name: 'Modesto', nameEn: 'Modest', group: 'salarios', condition: 'Siempre',
      effect: 'Pide un 15% menos de salario', reading: 'Mismo output, hora más barata; margen gratis',
      verdict: 'good', weight: 10
    },
    {
      name: 'Trepador', nameEn: 'Climber', group: 'salarios', condition: 'Siempre',
      effect: 'La expectativa de salario sube +2% por semana', reading: 'Barato un mes, caro después de un año',
      verdict: 'bad', weight: 10
    },
    {
      name: 'Leal', nameEn: 'Loyal', group: 'retencion', condition: 'Siempre',
      effect: 'Las penalizaciones de felicidad se reducen a la mitad', reading: 'El amigo de los países con impuestos',
      verdict: 'good', weight: 5
    },
    {
      name: 'Riesgo de fuga', nameEn: 'Flight risk', group: 'retencion', condition: 'Siempre',
      effect: 'Puede irse por debajo de 50 en vez de 30', reading: 'Por debajo de 50 desde el primer día con cualquier impuesto sobre la renta',
      verdict: 'bad', weight: 10
    },
    {
      name: 'Ancla', nameEn: 'Anchor', group: 'retencion', condition: 'Felicidad baja',
      effect: 'Nunca se va, -50% de producción mientras está infeliz', reading: 'Nunca se va, pero por debajo de 30 trabaja a la mitad',
      verdict: 'mixed', weight: 5
    },
    {
      name: 'Carroñero', nameEn: 'Scavenger', group: 'botin', condition: 'Siempre',
      effect: 'Probabilidad de caja de herramientas x2, -25% de producción', reading: 'Cazador de cajas con un cuarto menos de output',
      verdict: 'mixed', weight: 2
    },
    {
      name: 'Rescatador', nameEn: 'Salvager', group: 'botin', condition: 'Almacén lleno',
      effect: 'Sigue encontrando cajas de herramientas con el almacén lleno', reading: 'Solo importa cuando se llena el almacén',
      verdict: 'good', weight: 5
    },
    {
      name: 'Apostador', nameEn: 'Gambler', group: 'botin', condition: 'Siempre',
      effect: '+3 de Suerte, -15% de producción', reading: 'Más cajas, menos output; los críticos de eventos cuentan doble',
      verdict: 'mixed', weight: 10
    },
    {
      name: 'Amuleto', nameEn: 'Lucky charm', group: 'botin', condition: 'Cualquier compañero',
      effect: '+3 de Suerte a los compañeros', reading: 'Rasgo de tripulación; solo no hace nada',
      verdict: 'good', weight: 5
    },
    {
      name: 'Gafe', nameEn: 'Jinx', group: 'botin', condition: 'Cualquier compañero',
      effect: '-2 de Suerte a los compañeros', reading: 'Inofensivo solo',
      verdict: 'bad', weight: 10
    },
    {
      name: 'Reclutador', nameEn: 'Recruiter', group: 'apoyo', condition: 'Siempre',
      effect: '+1 candidato al día', reading: 'Cuatro cartas al día; hasta 3 espacios extra se acumulan',
      verdict: 'good', weight: 2
    },
    {
      name: 'Entrenador', nameEn: 'Trainer', group: 'apoyo', condition: 'Cualquier compañero',
      effect: '+1 de entrenamiento al día a los compañeros', reading: 'Duplica el entrenamiento de la tripulación',
      verdict: 'good', weight: 5
    }
  ];

  const EVENTS = [
    {
      label: 'Acogedores', count: 17, items: [
        'Tarjeta de cumpleaños', 'Máquina de café', 'Cumplido', 'Bolsa olvidada',
        'Caja de herramientas encontrada', 'Arrullo general', 'Caricia en la cabeza',
        'Impresión', 'Niño en el trabajo', 'Pósteres de gatitos', 'Alijo en la taquilla',
        'Planta de plástico', 'Primo del reclutador', 'Patos de goma', 'Gato callejero',
        'Buzón de sugerencias', 'Tatuaje'
      ]
    },
    {
      label: 'Vida', count: 20, items: [
        'Horóscopo malo', 'Campamento de entrenamiento', 'Herramienta maldita',
        'Uvas verdes', 'Título del puesto', 'Karaoke', 'Escaleras', 'Carta de casa',
        'Billete de lotería', 'Crisis de la mediana edad', 'Trabajo extra', 'Silla movida',
        'Clases nocturnas', 'Fiesta de una persona', 'Jubilación', 'Tentempié de casa',
        'Ascensor atascado', 'Carrera de furgonetas', 'Historias de guerra',
        'Aniversario laboral'
      ]
    },
    {
      label: 'Social', count: 10, items: [
        'Fuerte de cajas', 'Amistad floreciente', 'Ladrón de almuerzos', 'Oferta de mentor',
        'Romance de oficina', 'Guerra de bromas', 'Mismo corte de pelo', 'Pelea',
        'Debate sobre sopa', 'Guerra del termostato'
      ]
    },
    {
      label: 'Inspiración', count: 9, items: [
        'Notas en el brazo', 'Gráfico de descansos', 'Eureka', 'Talento oculto',
        'Manitas del turno de noche', 'En racha', 'Secreto del rival',
        'Descubrimiento del sándwich', 'Atajo'
      ]
    },
    {
      label: 'Crisis', count: 8, items: [
        'Agotamiento', 'Oportunidad de negocio', 'Deudas de juego', 'Renuncia perdida',
        'Oferta de caza de talentos', 'Inspector de seguridad', 'Máquina humeante',
        'Sindicato de uno'
      ]
    },
    {
      label: 'Mundo', count: 4, items: [
        'Ataque aéreo', 'Llamada a las armas', 'Panfletos enemigos', 'Racionamiento de guerra'
      ]
    },
    {
      label: 'Legendarios', count: 2, items: ['Hora dorada', 'Estado de ánimo extraño']
    },
    {
      label: 'Cadena', count: 8, items: [
        'Gerald solicita', 'Gatitos', 'Promesa de la carta de casa', 'Planta crecida',
        'Problemas de romance', 'Exigencia del estado de ánimo', 'Título para el jefe',
        'Huelga sindical'
      ]
    }
  ];

  const DAY_ONE = [
    'Revisa tu dinero. Los salarios salen de la empresa cada hora; una empresa sin caja es una empresa parada. Ten al menos un día de salarios en cada empresa.',
    'Lee las tres cartas antes de contratar. El salario sigue la Producción base y la expectativa; la Producción que viene de un rasgo es output que no pagas. Prioriza la hora barata y luego el rasgo de Producción.',
    'Busca rasgos de Producción (Especialista, Artesano u Obrero en el bien correcto; Patriota en casa), Reclutador, Modesto, Leal, Manitas si ya tienes herramienta, o Solitario en una empresa de un solo asiento. Evita Codicioso, Trepador, Agotado y, en país con impuestos, Riesgo de fuga y Tímido fiscal.',
    'Cada empleado que puedas contratar da beneficio: el output se vende al menos al valor PP en que se basa el salario, y los boosts van aparte. Mejora la Break Room cuando quieras el siguiente asiento: 20 acero para el segundo, 80 para el tercero.',
    'Cada empresa puede mudarse una vez sin coste. Úsalo para ponerla en una región core de tu país: +5% de output por empleado, sea cual sea su nacionalidad. El antiguo bonus de producción del país ya no existe; fuera del core solo importan los impuestos y la seguridad de la región.',
    'Emprendimiento desaparece y se reembolsa: reinvierte esos puntos. Liderazgo es nuevo; la Energía empieza en 100.'
  ];

  const WEEK_ONE = [
    'Entrena cada día que puedas: 10 de energía por carta. Una carta de salario bajo es margen puro; una de Producción sube también el salario; una de rasgo con Producción es output gratis.',
    'Mantén el mismo bien: +1% al día hasta +20%, el boost más barato. El porcentaje se recuerda por bien; volver a un bien anterior reanuda el bonus, y solo un bien nuevo empieza en 0.',
    'Responde a los eventos en 36 horas o el juego responde por ti.',
    'Vigila la felicidad en países con impuestos. Con más del 20% de impuesto sobre la renta, un empleado nuevo queda por debajo de 30 y puede irse.',
    'No despidas para hacer sitio: cada despido cuesta 5 de felicidad a los demás durante un día.'
  ];

  const ONGOING = [
    'Equipa herramientas cuando caiga una caja; la Suerte decide la frecuencia, como máximo 2% por hora.',
    'Planifica la jubilación: un empleado contratado a los 45 tiene 20 días laborables. Los jóvenes con las mismas stats valen más. A los 65 eliges: pagar 5 días de salario para retenerlo, dejarlo ir por +1 de un compañero, o apostar 5 de felicidad de la tripulación por 10 años más.',
    'Al nivel 10, mira el mercado de managers, desde ambos lados.'
  ];

  const PRIORITIZE = [
    'Manitas — con cualquier herramienta',
    'Improvisador — hasta la primera caja',
    'Especialista — en su bien',
    'Aprendiz rápido — mismo bien',
    'Acumulador — almacén lleno',
    'Patriota — región core',
    'Expatriado — fuera de casa',
    'Leal — países con impuestos',
    'Modesto — salario más barato',
    'Reclutador — +1 candidato/día',
    'Entrenador — +1 entrenamiento/día',
    'Solitario — empresa de 1 asiento',
    'Nacionalista / Cosmopolita — según la tripulación'
  ];

  const MIXED = [
    'Sociable', 'Cómico', 'Mentor', 'Rival', 'Diva', 'Matón',
    'Artesano', 'Obrero', 'Ancla', 'Carroñero', 'Apostador'
  ];

  const AVOID = [
    'Codicioso', 'Trepador', 'Agotado', 'Riesgo de fuga', 'Tímido fiscal',
    'Xenófobo', 'Envidioso', 'Némesis', 'Misándrico', 'Misógino',
    'Claustrofóbico', 'Rutinario', 'Desgastado', 'Nostálgico', 'Gafe'
  ];

  const NEVER_TOGETHER = [
    'Manitas + Improvisador', 'Solitario + Sociable', 'Cosmopolita + Xenófobo',
    'Cómico + Matón', 'Artesano + Obrero', 'Expatriado + Nostálgico',
    'Estatista + Tímido fiscal', 'Velocista + Rutinario', 'Velocista + Veterano',
    'Diamante en bruto + Agotado', 'Codicioso + Modesto', 'Riesgo de fuga + Ancla',
    'Amuleto + Gafe', 'Carroñero + Manitas'
  ];

  const GOOD_CHANGES = [
    'Se acabó buscar trabajo en el tablón. Las empresas producen cada hora sin que pulses «trabajar».',
    'La energía pasa de 30 a 100 (+10 por nivel) y el auto-trabajo de 10 a 30 PP (+3 por nivel).',
    'La gestión ya no limita cuántos empleados puedes contratar. Los puntos de Emprendimiento vuelven.',
    'Herramientas: un boost del 65% para una mítica es más de lo que da cualquier habilidad.',
    'El trabajo de manager es un segundo ingreso al nivel 10 sin tener empresa.'
  ];

  const BAD_CHANGES = [
    'Los jugadores ya no ganan salarios. Tu propio trabajo es solo auto-trabajo, 30 PP por sesión.',
    'Los salarios son automáticos y horarios: si el dueño se queda sin dinero, pierde toda la hora de output.',
    'El impuesto sobre la renta ahora duele dos veces: en el bruto y en la felicidad. Los países con impuestos altos perderán empleados.',
    'El mercado y las MU se abren al nivel 5; crafting y habilidades militares al 10; los partidos al 15. Los nuevos esperan.',
    'La suerte, la felicidad y los eventos añaden varianza que el sistema anterior no tenía.'
  ];

  const BASICS_GOOD = [
    'Manitas', 'Especialista', 'Patriota', 'Modesto', 'Leal', 'Reclutador'
  ];

  const BASICS_MIXED = [
    'Sociable', 'Cómico', 'Artesano', 'Obrero'
  ];

  const BASICS_BAD = [
    'Codicioso', 'Trepador', 'Agotado', 'Riesgo de fuga', 'Tímido fiscal', 'Xenófobo'
  ];

  function groupLabel(key) {
    const group = GROUPS.find(item => item.key === key);
    return group ? group.label : key;
  }

  function verdictLabel(key) {
    const verdict = VERDICTS.find(item => item.key === key);
    return verdict ? verdict.label : key;
  }

  function listItems(items) {
    return items.map(item => `<li>${item}</li>`).join('');
  }

  function traitRows() {
    return TRAITS.map(trait => `
      <tr class="wf-trait-row" data-group="${trait.group}" data-verdict="${trait.verdict}">
        <td class="wf-trait-name"><span title="${trait.nameEn}">${trait.name}</span></td>
        <td><span class="wf-group-tag">${groupLabel(trait.group)}</span></td>
        <td>${trait.condition}</td>
        <td>${trait.effect}</td>
        <td class="wf-reading">${trait.reading}</td>
        <td><span class="wf-verdict wf-verdict-${trait.verdict}">${verdictLabel(trait.verdict)}</span></td>
        <td class="wf-weight">${trait.weight}</td>
      </tr>`).join('');
  }

  function panelHead(kicker, title, lead) {
    return `
      <div class="wf-panel-head">
        <p class="wf-kicker">${kicker}</p>
        <h2>${title}</h2>
        <p class="wf-panel-lead">${lead}</p>
      </div>`;
  }

  function sectionHead(step, title, subtitle) {
    return `
      <div class="wf-section-head">
        <span class="wf-step">${step}</span>
        <div>
          <h2>${title}</h2>
          <p>${subtitle}</p>
        </div>
      </div>`;
  }

  function cards(items) {
    return `
      <div class="wf-cards">
        ${items.map((text, index) => `
          <article class="wf-card">
            <span class="wf-card-index">${index + 1}</span>
            <p>${text}</p>
          </article>`).join('')}
      </div>`;
  }

  function miniTable(headers, rows) {
    return `
      <div class="wf-mini-table-wrap">
        <table class="wf-mini-table">
          <thead><tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr></thead>
          <tbody>
            ${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function buildHero() {
    return `
      <div class="wf-hero">
        <div class="wf-hero-copy">
          <p class="wf-kicker">Guía de empleados · v0.27</p>
          <h2>WorkForce</h2>
          <p class="wf-lead">Contratar, pagar y cuidar a tu plantilla, explicado en pestañas. Empieza por Básicos; la Guía completa tiene todo el detalle.</p>
        </div>
        <div class="wf-hero-badges">
          <span class="wf-pill wf-pill-warn">Guía v0.27</span>
          <span class="wf-pill">Valores provisionales</span>
        </div>
      </div>`;
  }

  function buildTabs() {
    return `
      <div class="wf-tabs-wrap">
        <div class="wf-tabs" role="tablist" aria-label="Secciones de WorkForce">
          ${TABS.map((tab, index) => `
            <button class="wf-tab${index === 0 ? ' is-active' : ''}"
              id="wf-tab-${tab.id}"
              type="button"
              role="tab"
              aria-selected="${index === 0 ? 'true' : 'false'}"
              aria-controls="wf-panel-${tab.id}"
              tabindex="${index === 0 ? '0' : '-1'}"
              data-wf-tab="${tab.id}">
              <span class="wf-tab-icon" aria-hidden="true">${tab.icon}</span>
              <span>${tab.label}</span>
            </button>`).join('')}
        </div>
      </div>`;
  }

  function buildPanel(id, label, content, active) {
    return `
      <section class="wf-panel"
        id="wf-panel-${id}"
        role="tabpanel"
        aria-labelledby="wf-tab-${id}"
        data-wf-panel="${id}"
        tabindex="0"${active ? '' : ' hidden'}>
        ${content}
      </section>`;
  }

  function buildBasics() {
    const content = `
      ${panelHead('Lo esencial', 'WorkForce en 2 minutos', 'Si solo vas a leer una pestaña, que sea esta. Abajo tienes el resto cuando lo necesites.')}

      <div class="wf-basics-grid">
        <article class="wf-basic-card">
          <span class="wf-basic-icon" aria-hidden="true">🏭</span>
          <h3>La empresa produce sola</h3>
          <p>Cada hora, sin pulsar «trabajar». Tú pones la caja y los empleados.</p>
        </article>
        <article class="wf-basic-card">
          <span class="wf-basic-icon" aria-hidden="true">💸</span>
          <h3>El salario sale cada hora</h3>
          <p>Ten al menos un día de salarios en cada empresa. Si no hay dinero, se pierde la hora.</p>
        </article>
        <article class="wf-basic-card">
          <span class="wf-basic-icon" aria-hidden="true">⚙️</span>
          <h3>La Producción del rasgo no se paga</h3>
          <p>El salario sigue la Producción base. Lo que da un rasgo es output gratis.</p>
        </article>
        <article class="wf-basic-card">
          <span class="wf-basic-icon" aria-hidden="true">🙂</span>
          <h3>La felicidad es dinero</h3>
          <p>Por debajo de 30 el empleado puede irse. Cada punto también mueve el output un 1%.</p>
        </article>
      </div>

      <section class="wf-section">
        ${sectionHead('01', 'Checklist del primer día', 'Seis cosas que no deberías olvidar.')}
        <ol class="wf-checklist">
          <li>Revisa la caja de cada empresa: al menos un día de salarios.</li>
          <li>Lee las tres cartas antes de contratar.</li>
          <li>Prioriza Producción, Modesto, Leal y Reclutador; evita Codicioso, Trepador, Agotado, Riesgo de fuga y Tímido fiscal.</li>
          <li>Mantén el mismo bien: +1% por día hasta +20%.</li>
          <li>Sube la Break Room cuando quieras otro asiento: 20 acero el segundo, 80 el tercero.</li>
          <li>Responde los eventos en 36 horas; a los 65 decide qué hacer con el empleado.</li>
        </ol>
      </section>

      <section class="wf-section">
        ${sectionHead('02', 'Semáforo de rasgos', 'Los más importantes, sin entrar en los 52.')}
        <div class="wf-quick-grid">
          <div class="wf-quick wf-quick-good">
            <h3>Prioriza</h3>
            <ul>${listItems(BASICS_GOOD)}</ul>
          </div>
          <div class="wf-quick wf-quick-mixed">
            <h3>Mixtos</h3>
            <ul>${listItems(BASICS_MIXED)}</ul>
          </div>
          <div class="wf-quick wf-quick-bad">
            <h3>Evita</h3>
            <ul>${listItems(BASICS_BAD)}</ul>
          </div>
        </div>
      </section>

      <section class="wf-section">
        ${sectionHead('03', 'Vocabulario', 'Las palabras que aparecen en el resto de la guía.')}
        <dl class="wf-glossary">
          <div><dt>PP</dt><dd>Punto de producción. Se usa para valorar lo que produce un empleado.</dd></div>
          <div><dt>Output</dt><dd>Producción por hora de un empleado o de una empresa.</dd></div>
          <div><dt>Expectativa</dt><dd>Salario que pide el empleado: 70–130%. Queda fija al contratar.</dd></div>
          <div><dt>Felicidad</dt><dd>Empieza en 50; mueve el output y la permanencia.</dd></div>
          <div><dt>Break Room</dt><dd>Sala que da asientos a la empresa.</dd></div>
          <div><dt>Manager</dt><dd>Gerente que añade output y cuidado diario.</dd></div>
        </dl>
      </section>

      <div class="wf-next">
        <button class="wf-next-btn" type="button" data-wf-goto="contratar">Siguiente: Contratar →</button>
      </div>`;

    return buildPanel('basicos', 'Básicos', content, true);
  }

  function buildHire() {
    const content = `
      ${panelHead('Contratar', 'Tres cartas al día', 'Contratar es barato; elegir mal cuesta una semana de salario.')}

      <section class="wf-section">
        ${sectionHead('01', 'Cómo leer una carta', 'Lo que muestra cada candidato.')}
        ${miniTable(['Dato', 'Qué significa'], [
          ['Producción', 'Base del output y del salario.'],
          ['Suerte', 'Más probabilidad de cajas de herramientas.'],
          ['Responsabilidad', 'Protege la felicidad de las malas noticias.'],
          ['Potencial', 'Entrenamientos que le quedan.'],
          ['Edad', 'A los 65 se jubila; un año pasa cada día.'],
          ['Expectativa', 'Salario que pide: 70–130%. Queda fija al contratar.'],
          ['Rasgo', 'Como máximo uno al contratar.']
        ])}
      </section>

      <section class="wf-section">
        ${sectionHead('02', 'El día de contratación', 'Qué hay, cuánto cuesta y cuándo renovar.')}
        ${cards([
          '3 candidatos por empresa, nuevos a las 00:00 UTC.',
          'Contratar cuesta 10 de energía.',
          'Stats de 1 a 4; el 50% trae un rasgo; potencial 3–10; edad 18–45.',
          'Cada hora, el output varía ±10%.',
          'Trabajar en tu propia empresa cuesta 10 de energía por sesión.',
          'Un Reclutador en plantilla añade 1 candidato al día, hasta 3 extra.'
        ])}
        <h3 class="wf-subhead">Energía para una tanda nueva</h3>
        ${miniTable(['Tanda', 'Energía', 'Total'], [
          ['1.ª', '10', '10'],
          ['2.ª', '20', '30'],
          ['3.ª', '40', '70'],
          ['4.ª', '80', '150'],
          ['5.ª', '160', '310']
        ])}
        <p class="wf-note">Dos tandas al día son asumibles; la tercera ya cuesta una pelea.</p>
      </section>

      <section class="wf-section">
        ${sectionHead('03', 'Break Room', 'Asientos, acero y cuándo ampliar.')}
        ${miniTable(['Nivel', 'Empleados', 'Acero', 'Acero total'], [
          ['1', '1', '0', '0'],
          ['2', '2', '20', '20'],
          ['3', '3', '80', '100']
        ])}
        <p class="wf-note">Cada empresa empieza con un asiento. Solitario quiere uno; Sociable quiere dos compañeros. Management ya no limita cuántos contratas.</p>
      </section>

      <div class="wf-next">
        <button class="wf-next-btn" type="button" data-wf-goto="salarios">Siguiente: Salarios →</button>
      </div>`;

    return buildPanel('contratar', 'Contratar', content);
  }

  function buildPayShot() {
    return `
      <figure class="wf-shot" id="wfPayShot">
        <img src="guias/workforce-panel.png"
          alt="Panel de WorkForce con empleados, producción diaria, salario por hora y balance"
          loading="eager" decoding="async">
        <div class="wf-shot-fallback" aria-hidden="true">
          <div class="wf-fallback-head">
            <span>WORKFORCE</span>
            <span class="wf-fallback-pill">17 to train</span>
          </div>
          <div class="wf-fallback-body">
            <div>
              <div class="wf-fallback-people">👥 17</div>
              <div class="wf-fallback-stats">
                <span>⛏️ 335.76</span>
                <span>💰 0.073</span>
              </div>
            </div>
            <div class="wf-fallback-right">
              <div class="wf-fallback-gain">+8.01 /día</div>
              <div class="wf-fallback-cost">1.1 /día</div>
            </div>
          </div>
          <div class="wf-fallback-legend">
            <span>Empleados</span>
            <span>Producción/día</span>
            <span>Salario/hora</span>
            <span>Balance/día</span>
            <span>Coste/día</span>
          </div>
        </div>
        <figcaption>Panel de WorkForce. Fíjate en los empleados, la producción diaria, el salario por hora y el balance. Los valores exactos dependen de tu empresa.</figcaption>
      </figure>`;
  }

  function buildPay() {
    const content = `
      ${panelHead('Salarios', 'Cuánto cuesta una hora', 'La fórmula, el impuesto y el margen, sin hojas de cálculo.')}

      ${buildPayShot()}

      <section class="wf-section">
        ${sectionHead('01', 'La fórmula sin misterio', 'De dónde sale el salario de cada hora.')}
        <div class="wf-formula">Salario/hora = (Producción base + entrenada) ÷ 4 × valor PP × expectativa × Codicioso × Modesto</div>
        <p class="wf-note">La Producción que viene de un rasgo <strong>no</strong> entra en el salario. Sube el output, no el sueldo.</p>
        ${miniTable(['Producción', 'PP/h', 'Salario 70%', 'Salario 100%', 'Salario 130%'], [
          ['1', '0,25', '0,0171', '0,0244', '0,0318'],
          ['2', '0,50', '0,0342', '0,0489', '0,0636'],
          ['3', '0,75', '0,0513', '0,0733', '0,0954'],
          ['4', '1,00', '0,0685', '0,0978', '0,1271']
        ])}
        <p class="wf-note">Ejemplo con valor PP 0,0978. Un día son 24 horas; la empresa debe tener el dinero antes de cada hora. Codicioso multiplica por 1,20; Modesto por 0,85.</p>
      </section>

      <section class="wf-section">
        ${sectionHead('02', 'Impuesto sobre la renta', 'El país cobra sobre el salario; el dueño paga el bruto.')}
        <div class="wf-callout">
          <strong>Dos golpes a la vez:</strong> cada 1% de impuesto sobre la renta también cuesta 1 de felicidad al empleado. Con 20% de impuesto, un empleado nuevo queda en 30: justo el límite antes de poder irse.
        </div>
        <p class="wf-note">El impuesto de manager es aparte. El salario se paga cada hora desde la caja de la empresa.</p>
      </section>

      <section class="wf-section">
        ${sectionHead('03', 'Tu margen', 'Lo que queda después de pagar el salario.')}
        <div class="wf-formula">Margen/hora = ingreso/hora − salario/hora</div>
        ${miniTable(['Factor', 'Efecto'], [
          ['Management del dueño', '+2% de output por punto.'],
          ['Manager contratado', '+2% por punto, hasta +22%.'],
          ['Dueño + manager', 'Tope combinado de +44%.'],
          ['Felicidad', '+1% por punto por encima de 50; −1% por debajo.'],
          ['Herramienta', '+3% (común) a +65% (mítica); dura 500 horas.'],
          ['Mismo bien', '+1% por día hasta +20%; se guarda por bien.'],
          ['Región core', '+5% para todos los empleados.']
        ])}
        <div class="wf-callout">
          <strong>Ejemplo rápido:</strong> Producción 3 → 0,75 PP/hora. Con PP 0,0978, el ingreso es 0,0733/hora; el salario al 100% también es 0,0733. Margen 0 antes de boosts. Los boosts son el beneficio.
        </div>
        <p class="wf-note">Si el ratio ingreso/salario baja de 1,00, el empleado cuesta más de lo que produce al valor PP. Un producto que se vende por encima del PP, Management, felicidad y herramienta suben el margen. La expectativa queda fija al contratar.</p>
      </section>

      <div class="wf-next">
        <button class="wf-next-btn" type="button" data-wf-goto="entrenar">Siguiente: Entrenar →</button>
      </div>`;

    return buildPanel('salarios', 'Salarios', content);
  }

  function buildTrain() {
    const content = `
      ${panelHead('Entrenar', 'Convierte Potencial en producción', 'Una carta al día por empleado. Elige la que más te acerque al margen.')}

      <section class="wf-section">
        ${sectionHead('01', 'Entrenamiento', 'Cómo funciona el sorteo diario.')}
        ${cards([
          'Un sorteo por empleado y día: 10 de energía y 1 de Potencial.',
          'Ves 3 cartas y te quedas con una.',
          'Las cartas suben una stat, bajan el salario, añaden o quitan un rasgo, o dan más Potencial.',
          'Liderazgo y la Suerte del empleado hacen más probables las cartas raras.',
          'El Potencial es el número de sorteos que le quedan; se puede entrenar hasta 15.',
          'Al contratar, como máximo un rasgo. Entrenamiento y eventos pueden añadir más.',
          'Pares como Codicioso + Modesto o Solitario + Sociable nunca comparten empleado.',
          'Una carta de salario baja la expectativa hasta 70%.'
        ])}
        <h3 class="wf-subhead">Probabilidades antes de Suerte y Liderazgo</h3>
        ${miniTable(['Rareza', 'Prob.', 'Producción', 'Salario'], [
          ['Común', '55%', '+1', '−5%'],
          ['Poco común', '25%', '—', '−10%'],
          ['Rara', '13%', '+4', '−20%'],
          ['Épica', '5%', '+2', '—'],
          ['Legendaria', '2%', '+3', '—']
        ])}
        <p class="wf-note">Cada punto de Suerte y cada nivel de Liderazgo mueven probabilidad de las cartas comunes a las raras.</p>
      </section>

      <section class="wf-section">
        ${sectionHead('02', '¿Vale +1 Producción?', 'El número que decide si entrenar compensa.')}
        <div class="wf-kpi-grid">
          <div class="wf-kpi"><strong>+6,00</strong><span>PP/día antes de boosts</span></div>
          <div class="wf-kpi"><strong>+0,5868</strong><span>ingreso/día al PP de ejemplo</span></div>
          <div class="wf-kpi"><strong>+0,5868</strong><span>salario/día</span></div>
          <div class="wf-kpi"><strong>0</strong><span>neto/día al 100% de expectativa</span></div>
        </div>
        <p class="wf-note">El salario sube con la Producción, así que entrenar solo compensa si el boost o el producto superan la expectativa. Una carta de salario más bajo es dinero gratis.</p>
      </section>

      <section class="wf-section">
        ${sectionHead('03', 'Herramientas y cajas', 'La Suerte decide cuándo caen; la Producción paga el salario.')}
        ${cards([
          '6 tipos de herramienta, uno por tipo de empresa.',
          'Una herramienta añade +3% a +65% de output.',
          'Se gasta a las 500 horas trabajadas, unas tres semanas.',
          'Cada hora trabajada, un empleado encuentra una caja con 0,1% por punto de Suerte, máximo 2%.'
        ])}
        ${miniTable(['Rareza', 'Prob.', 'Por mes'], [
          ['Común', '35%', '1,535'],
          ['Poco común', '37%', '1,622'],
          ['Rara', '20%', '0,877'],
          ['Épica', '6,5%', '0,285'],
          ['Legendaria', '1,3%', '0,057'],
          ['Mítica', '0,2%', '0,009']
        ])}
        <p class="wf-note">Con Suerte 4 en tres asientos salen unas 1,5 cajas por semana; una mítica cada varios años. La Suerte es para cajas; la Producción paga el salario.</p>
      </section>

      <div class="wf-next">
        <button class="wf-next-btn" type="button" data-wf-goto="riesgos">Siguiente: Riesgos →</button>
      </div>`;

    return buildPanel('entrenar', 'Entrenar', content);
  }

  function buildEventsDetails() {
    return `
      <details class="wf-events-details">
        <summary>
          <span>Ver los 78 eventos por grupo</span>
          <span class="wf-summary-hint">Nombres orientativos</span>
        </summary>
        <div class="wf-events-grid">
          ${EVENTS.map(group => `
            <article class="wf-event-group">
              <h4>${group.label} <span>${group.count}</span></h4>
              <ul class="wf-event-list">${listItems(group.items)}</ul>
            </article>`).join('')}
        </div>
      </details>`;
  }

  function buildRisk() {
    const content = `
      ${panelHead('Riesgos', 'La felicidad y los eventos', 'Deciden quién se queda, quién rinde y cuándo toca jubilar a alguien.')}

      <section class="wf-section">
        ${sectionHead('01', 'Cuenta de felicidad', 'Empiezas en 50. Todo lo que sube y baja.')}
        <div class="wf-kpi-grid">
          <div class="wf-kpi"><strong>50</strong><span>felicidad inicial</span></div>
          <div class="wf-kpi"><strong>30</strong><span>límite de fuga normal</span></div>
          <div class="wf-kpi"><strong>50</strong><span>límite con Riesgo de fuga</span></div>
          <div class="wf-kpi"><strong>1%</strong><span>de output por punto</span></div>
        </div>
        ${miniTable(['Situación', 'Felicidad', 'Duración'], [
          ['Compañero despedido', '−5', '24 h'],
          ['Empleado mudado a otra empresa', '−5', '7 días'],
          ['Empresa mudada', '−10', '7 días'],
          ['Almacén lleno', '−10', 'mientras siga lleno'],
          ['Hora de salario impagada', '−10', '—'],
          ['Batalla en la región', '−5', '—'],
          ['Cuidado del manager', '+5', '48 h']
        ])}
        <p class="wf-note">Responsabilidad protege de las malas noticias; con 10 puntos, del todo. Leal reduce todas las penalizaciones a la mitad.</p>
      </section>

      <section class="wf-section">
        ${sectionHead('02', 'Impuestos, fugas y mudanzas', 'Lo que puede romper una plantilla.')}
        ${cards([
          'Con 20% de impuesto sobre la renta, un empleado nuevo queda en 30: el máximo antes de poder irse.',
          'Por debajo de 30, la probabilidad de fuga es como máximo 5% por chequeo.',
          'Una batalla en la región tiene 1% de probabilidad de matar a un empleado.',
          'Un empleado mudado no puede ser despedido durante 24 horas.',
          'Cada empresa puede mudarse una vez gratis. Úsalo para una región core: +5% de output para todos.'
        ])}
      </section>

      <section class="wf-section">
        ${sectionHead('03', 'Eventos y jubilación', 'Lo que pasa solo si no entras cada día.')}
        ${cards([
          'Hay 78 eventos. Con 3 empleados, espera unos 1 al día, nunca más de 3.',
          'Solo participan empleados con 48 horas en la empresa.',
          'Sin respuesta, el evento se resuelve solo en 36 horas. Entra cada 3 días o el juego decide por ti.',
          'Sin eventos durante 72 horas, llega uno; el mismo empleado espera 24 horas entre dos.',
          'Los eventos pueden subir la expectativa de salario hasta 160%.',
          'A los 65 el empleado pregunta; después, cada 10 días. Cada año extra es 5% más difícil. Un empleado de 45 tiene 20 días laborables.'
        ])}
        <h3 class="wf-subhead">Las tres respuestas a los 65</h3>
        ${miniTable(['Respuesta', 'Coste', 'Qué ganas'], [
          ['Mantener', '5 días de salario', 'Se queda; la siguiente pregunta llega en 10 días.'],
          ['Dejar ir', 'El empleado se va', 'Un compañero gana +1 a una stat; con crítico, un rasgo bueno; todos ganan felicidad.'],
          ['Apostar', 'Los compañeros pierden 5 de felicidad durante 3 días', 'Probabilidad de 10 años más; la Suerte ayuda.']
        ])}
      </section>

      <section class="wf-section">
        ${sectionHead('04', 'Los 78 eventos', 'Agrupados para que puedas buscarlos rápido.')}
        ${buildEventsDetails()}
      </section>

      <div class="wf-next">
        <button class="wf-next-btn" type="button" data-wf-goto="manager">Siguiente: Manager →</button>
      </div>`;

    return buildPanel('riesgos', 'Riesgos', content);
  }

  function buildManager() {
    const content = `
      ${panelHead('Manager', 'Un segundo sueldo y un boost', 'El manager añade output a la empresa o cobra por gestionar la de otro.')}

      <section class="wf-section">
        ${sectionHead('01', 'Ser manager', 'Qué hace y cuánto puede aportar.')}
        ${cards([
          'Se desbloquea al nivel 10.',
          'Un trabajo por empresa; se encuentra en el mercado de managers.',
          'El pago va por punto de Management y debe estar dentro del 80–120% de la media actual.',
          'Cambiar el pago bloquea el puesto durante 24 horas.',
          'Añade +2% de output por punto, hasta +22%.',
          'Con el Management del dueño, el tope combinado es +44%.',
          'Una vez al día cuida a un empleado: +5 de felicidad durante 48 horas.',
          'El pago se acumula cada hora; cobra y paga el impuesto de manager del país.'
        ])}
        <h3 class="wf-subhead">Output por puntos</h3>
        ${miniTable(['Puntos', 'Bonus'], [
          ['1', '+2%'],
          ['5', '+10%'],
          ['10', '+20%'],
          ['11', '+22%']
        ])}
        <p class="wf-note">11 puntos llenan el tope. Más puntos pagan más, pero no dan más output.</p>
      </section>

      <section class="wf-section">
        ${sectionHead('02', 'Contratar un manager', 'Cuándo compensa pagar por gestionar.')}
        ${cards([
          'Compensa cuando el output extra supera el pago.',
          'Ejemplo: 3 empleados de Producción 3 dan 2,25 PP/hora de base; +22% son 0,495 PP/hora extra.',
          'Compara esos 0,495 PP/hora al precio de tu bien con puntos × pago.',
          'La media de pago aparece en el mercado cuando la v0.27 esté live.',
          'Un manager que cuida a diario mantiene a un empleado +5 por encima del límite. En un país con 20% de impuesto, es la diferencia entre 30 y 35.'
        ])}
        <div class="wf-callout">
          <strong>Checklist:</strong> ¿tienes 3 o más empleados? ¿El output extra supera el pago? ¿Puedes pagar el impuesto de manager?
        </div>
      </section>

      <div class="wf-next">
        <button class="wf-next-btn" type="button" data-wf-goto="guia">Siguiente: Guía completa →</button>
      </div>`;

    return buildPanel('manager', 'Manager', content);
  }

  function buildGuide() {
    const content = `
      ${panelHead('Guía completa', 'Todo el detalle', 'La lectura larga: día 1, primera semana, rasgos y cambios.')}

      <div class="wf-callout wf-callout-warn">
        <strong>Valores provisionales:</strong> esta guía resume la v0.27. Los números pueden ajustarse con datos reales; úsala como referencia práctica, no como una medición exacta.
      </div>

      <nav class="wf-index" aria-label="Secciones de la guía">
        <a href="#wf-dia-1">Día 1</a>
        <a href="#wf-semana-1">Semana 1</a>
        <a href="#wf-continuo">Continuo</a>
        <a href="#wf-rasgos">Rasgos</a>
        <a href="#wf-cambios">Buenos y malos cambios</a>
      </nav>

      <section class="wf-section" id="wf-dia-1">
        ${sectionHead('01', 'Día 1: justo después del parche', 'Lo primero que conviene revisar y decidir.')}
        <div class="wf-cards">
          ${DAY_ONE.map((text, index) => `<article class="wf-card"><span class="wf-card-index">${index + 1}</span><p>${text}</p></article>`).join('')}
        </div>
      </section>

      <section class="wf-section" id="wf-semana-1">
        ${sectionHead('02', 'Semana 1', 'Entrenar, mantener el bien y cuidar la felicidad.')}
        <div class="wf-cards">
          ${WEEK_ONE.map((text, index) => `<article class="wf-card"><span class="wf-card-index">${index + 1}</span><p>${text}</p></article>`).join('')}
        </div>
      </section>

      <section class="wf-section" id="wf-continuo">
        ${sectionHead('03', 'Continuo', 'Herramientas, jubilación y manager.')}
        <div class="wf-cards">
          ${ONGOING.map((text, index) => `<article class="wf-card"><span class="wf-card-index">${index + 1}</span><p>${text}</p></article>`).join('')}
        </div>
      </section>

      <section class="wf-section" id="wf-rasgos">
        ${sectionHead('04', 'Rasgos: qué buscar y qué evitar', 'Resumen rápido y tabla completa de los 52 rasgos.')}

        <div class="wf-quick-grid">
          <div class="wf-quick wf-quick-good">
            <h3>Prioriza</h3>
            <ul>${listItems(PRIORITIZE)}</ul>
          </div>
          <div class="wf-quick wf-quick-mixed">
            <h3>Mixtos</h3>
            <ul>${listItems(MIXED)}</ul>
          </div>
          <div class="wf-quick wf-quick-bad">
            <h3>Evita</h3>
            <ul>${listItems(AVOID)}</ul>
          </div>
        </div>

        <p class="wf-note">Tabla completa de los 52 rasgos del cliente.</p>

        <details class="wf-traits-details">
          <summary>
            <span>Ver los 52 rasgos y sus efectos</span>
            <span class="wf-summary-hint">Filtra por grupo o veredicto</span>
          </summary>
          <div class="wf-filters">
            <label>Grupo
              <select id="wfGroupFilter">
                <option value="">Todos</option>
                ${GROUPS.map(group => `<option value="${group.key}">${group.label}</option>`).join('')}
              </select>
            </label>
            <label>Veredicto
              <select id="wfVerdictFilter">
                <option value="">Todos</option>
                ${VERDICTS.map(verdict => `<option value="${verdict.key}">${verdict.label}</option>`).join('')}
              </select>
            </label>
            <label class="wf-search-label">Buscar
              <input id="wfSearch" type="search" placeholder="Nombre o efecto…" autocomplete="off">
            </label>
            <span class="wf-trait-count" id="wfTraitCount" aria-live="polite">${TRAITS.length} rasgos</span>
          </div>
          <div class="wf-table-wrap">
            <table class="wf-table">
              <thead>
                <tr>
                  <th>Rasgo</th>
                  <th>Grupo</th>
                  <th>Cuándo</th>
                  <th>Efecto</th>
                  <th>Lectura</th>
                  <th>Veredicto</th>
                  <th>Peso</th>
                </tr>
              </thead>
              <tbody>${traitRows()}</tbody>
            </table>
          </div>
          <div class="wf-never">
            <h4>Nunca juntos en un mismo empleado</h4>
            <div class="wf-never-grid">${NEVER_TOGETHER.map(pair => `<span>${pair}</span>`).join('')}</div>
          </div>
        </details>
      </section>

      <section class="wf-section" id="wf-cambios">
        ${sectionHead('05', 'Buenos y malos cambios', 'El balance de la v0.27, para cerrar la guía.')}
        <div class="wf-changes">
          <article class="wf-change-card wf-change-good">
            <h3>Buenos cambios</h3>
            <ul>${listItems(GOOD_CHANGES)}</ul>
          </article>
          <article class="wf-change-card wf-change-bad">
            <h3>Malos cambios</h3>
            <ul>${listItems(BAD_CHANGES)}</ul>
          </article>
        </div>
      </section>

      <footer class="wf-footer">
        <p>WorkForce · guía v0.27. Los veredictos y lecturas son una interpretación práctica, no una medición en vivo.</p>
      </footer>`;

    return buildPanel('guia', 'Guía completa', content);
  }

  function buildHtml() {
    return `
      ${buildHero()}
      ${buildTabs()}
      <div class="wf-panels">
        ${buildBasics()}
        ${buildHire()}
        ${buildPay()}
        ${buildTrain()}
        ${buildRisk()}
        ${buildManager()}
        ${buildGuide()}
      </div>`;
  }

  function bindFilters(root) {
    const groupFilter = root.querySelector('#wfGroupFilter');
    const verdictFilter = root.querySelector('#wfVerdictFilter');
    const search = root.querySelector('#wfSearch');
    const count = root.querySelector('#wfTraitCount');
    const rows = Array.from(root.querySelectorAll('.wf-trait-row'));
    if (!groupFilter || !verdictFilter || !search || !count) return;

    const apply = () => {
      const group = groupFilter.value;
      const verdict = verdictFilter.value;
      const query = search.value.trim().toLowerCase();
      let visible = 0;

      rows.forEach(row => {
        const matchesGroup = !group || row.dataset.group === group;
        const matchesVerdict = !verdict || row.dataset.verdict === verdict;
        const matchesQuery = !query || row.textContent.toLowerCase().includes(query);
        const show = matchesGroup && matchesVerdict && matchesQuery;
        row.hidden = !show;
        if (show) visible++;
      });

      count.textContent = `${visible} de ${rows.length} rasgos`;
    };

    groupFilter.addEventListener('change', apply);
    verdictFilter.addEventListener('change', apply);
    search.addEventListener('input', apply);
    apply();
  }

  function bindImageFallback(root) {
    const image = root.querySelector('.wf-shot img');
    if (!image) return;

    const markMissing = () => {
      const figure = image.closest('.wf-shot');
      if (figure) figure.classList.add('is-missing');
    };

    image.addEventListener('error', markMissing);
    if (image.complete && image.naturalWidth === 0) markMissing();
  }

  function bindTabs(root) {
    const tabs = Array.from(root.querySelectorAll('[data-wf-tab]'));
    const panels = Array.from(root.querySelectorAll('[data-wf-panel]'));
    if (!tabs.length || !panels.length) return;

    const tabIds = new Set(tabs.map(tab => tab.dataset.wfTab));
    const guideSections = ['wf-dia-1', 'wf-semana-1', 'wf-continuo', 'wf-rasgos', 'wf-cambios'];

    const updateHash = id => {
      try {
        history.replaceState(null, '', `#wf-tab-${id}`);
      } catch (error) {
        /* file:// o historial bloqueado: no pasa nada */
      }
    };

    const activate = (id, options = {}) => {
      if (!tabIds.has(id)) return;

      tabs.forEach(tab => {
        const active = tab.dataset.wfTab === id;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
        tab.tabIndex = active ? 0 : -1;
      });

      panels.forEach(panel => {
        panel.hidden = panel.dataset.wfPanel !== id;
      });

      if (options.focusTab) {
        const tab = root.querySelector(`[data-wf-tab="${id}"]`);
        if (tab) tab.focus();
      }

      if (options.focusPanel) {
        const panel = root.querySelector(`[data-wf-panel="${id}"]`);
        if (panel) panel.focus({ preventScroll: true });
      }

      if (options.updateHash !== false) updateHash(id);
    };

    const fromHash = () => {
      const raw = decodeURIComponent((location.hash || '').replace(/^#/, ''));
      if (!raw) return null;

      if (raw.startsWith('wf-tab-')) {
        const id = raw.slice('wf-tab-'.length);
        return tabIds.has(id) ? { id, scroll: null } : null;
      }

      if (guideSections.includes(raw)) return { id: 'guia', scroll: raw };
      return null;
    };

    const scrollToSection = sectionId => {
      const target = root.querySelector(`#${sectionId}`);
      if (target) target.scrollIntoView({ block: 'start' });
    };

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activate(tab.dataset.wfTab));

      tab.addEventListener('keydown', event => {
        let target = null;
        if (event.key === 'ArrowRight') target = tabs[(index + 1) % tabs.length];
        else if (event.key === 'ArrowLeft') target = tabs[(index - 1 + tabs.length) % tabs.length];
        else if (event.key === 'Home') target = tabs[0];
        else if (event.key === 'End') target = tabs[tabs.length - 1];
        if (!target) return;
        event.preventDefault();
        activate(target.dataset.wfTab, { focusTab: true });
      });
    });

    root.querySelectorAll('[data-wf-goto]').forEach(button => {
      button.addEventListener('click', () => {
        const id = button.dataset.wfGoto;
        activate(id, { focusPanel: true });
        const panel = root.querySelector(`[data-wf-panel="${id}"]`);
        if (panel) panel.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
    });

    const initial = fromHash();
    if (initial) {
      activate(initial.id, { updateHash: false });
      if (initial.scroll) {
        scrollToSection(initial.scroll);
        requestAnimationFrame(() => scrollToSection(initial.scroll));
        setTimeout(() => scrollToSection(initial.scroll), 80);
      }
    } else {
      activate('basicos', { updateHash: false });
    }

    window.addEventListener('hashchange', () => {
      const target = fromHash();
      if (!target) return;
      activate(target.id, { updateHash: false });
      if (target.scroll) {
        scrollToSection(target.scroll);
        requestAnimationFrame(() => scrollToSection(target.scroll));
      }
    });
  }

  function render(container) {
    if (!container || container.dataset.wfRendered === '1') return;
    container.innerHTML = buildHtml();
    bindTabs(container);
    bindFilters(container);
    bindImageFallback(container);
    container.dataset.wfRendered = '1';
  }

  window.WareraWorkforce = {
    render,
    meta: {
      tabs: TABS,
      traits: TRAITS,
      events: EVENTS
    }
  };
})();
