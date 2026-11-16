// Base de datos de lugares, traducciones y tips para Buenos Aires
const APP_DATA = {
  // Configuración de contacto / reservas
  config: {
    agencyWhatsApp: "5491122334455", // Cambiar por tu WhatsApp o el de la agencia aliada
    driverWhatsApp: "5491199887766"  // Cambiar por el WhatsApp del chofer/remís de confianza
  },

  // Lugares cargados para el mapa y las listas
  places: [
    {
      id: "p1",
      category: "food",
      name: "Parrilla Don Julio",
      neighborhood: "Palermo",
      lat: -34.5878,
      lng: -58.4239,
      price: "$$$$",
      tag: "Top Mundial",
      image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80",
      tips: {
        es: "Considerada una de las mejores del mundo. Ojo: reservar con semanas de anticipación o ir a las 11:30 hs a hacer fila para el almuerzo.",
        en: "Ranked among the world's best steakhouses. Tip: book weeks in advance or show up at 11:30 AM to wait for lunch walk-ins.",
        pt: "Uma das melhores churrascarias do mundo. Dica: reserve com semanas de antecedência ou chegue às 11h30 para tentar vaga no almoço."
      }
    },
    {
      id: "p2",
      category: "food",
      name: "Parrilla Peña",
      neighborhood: "Tribunales / Centro",
      lat: -34.6033,
      lng: -58.3905,
      price: "$$",
      tag: "Bodegón Auténtico",
      image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&auto=format&fit=crop&q=80",
      tips: {
        es: "Carne tierna y ambiente 100% porteño sin precios inflados para turistas. Te reciben con una empanada frita de cortesía.",
        en: "Tender meat, true local atmosphere without tourist-trap prices. They welcome you with a complimentary fried empanada.",
        pt: "Carne macia e ambiente autêntico portenho com preços justos. Recebem você com uma empanada frita de cortesia."
      }
    },
    {
      id: "p3",
      category: "food",
      name: "Pizzería Güerrin",
      neighborhood: "Calle Corrientes",
      lat: -34.6041,
      lng: -58.3862,
      price: "$$",
      tag: "Clásico Porteño",
      image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80",
      tips: {
        es: "La pizza al molde más famosa desde 1932. Pedí muzza al corte en el mostrador parado o sentate al fondo.",
        en: "The most famous thick-crust pizza in town since 1932. Eat a slice standing at the counter or take a table in the back.",
        pt: "A pizza mais famosa da cidade desde 1932. Peça uma fatia de mussarela no balcão em pé ou sente-se nos fundos."
      }
    },
    {
      id: "t1",
      category: "tango",
      name: "Madero Tango",
      neighborhood: "Puerto Madero",
      lat: -34.6144,
      lng: -58.3622,
      price: "$$$",
      tag: "Cena Show + Vista al Río",
      commissionable: true,
      image: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80",
      tips: {
        es: "Show moderno con vista panorámica a los diques de Puerto Madero. Ideal parejas y familias. Incluye traslado.",
        en: "Modern musical tango show with panoramic views of the docks. Includes dinner, wine, and optional hotel pickup.",
        pt: "Show moderno com vista panorâmica dos diques de Puerto Madero. Inclui jantar, vinho e traslado opcional."
      }
    },
    {
      id: "t2",
      category: "tango",
      name: "El Querandí",
      neighborhood: "San Telmo",
      lat: -34.6120,
      lng: -58.3750,
      price: "$$$",
      tag: "Histórico e Íntimo",
      commissionable: true,
      image: "https://images.unsplash.com/photo-1545232979-fbf68fe9f1f8?w=600&auto=format&fit=crop&q=80",
      tips: {
        es: "Una casona colonial de 1920 en San Telmo. Show tradicional e intimista que recorre la historia del tango década a década.",
        en: "Colonial 1920s house in San Telmo. An intimate, authentic journey through the history of tango decade by decade.",
        pt: "Casarão colonial dos anos 1920 em San Telmo. Show íntimo e autêntico que percorre a história do tango década a década."
      }
    },
    {
      id: "s1",
      category: "shopping",
      name: "Galerías Pacífico",
      neighborhood: "Microcentro / Florida",
      lat: -34.5997,
      lng: -58.3748,
      price: "$$$",
      tag: "Monumento Histórico",
      image: "https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?w=600&auto=format&fit=crop&q=80",
      tips: {
        es: "Cúpula pintada por grandes artistas argentinos. Marcas internacionales y locales. Ojo con carteristas sobre calle Florida.",
        en: "Stunning hand-painted ceiling dome. Top brands and leather shops. Keep an eye on personal belongings on Florida St.",
        pt: "Cúpula espetacular pintada por mestres argentinos. Lojas de couro e marcas de ponta. Fique atento na rua Florida."
      }
    },
    {
      id: "s2",
      category: "shopping",
      name: "Alto Palermo Shopping",
      neighborhood: "Palermo",
      lat: -34.5880,
      lng: -58.4106,
      price: "$$",
      tag: "Moda & Compras",
      image: "https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=600&auto=format&fit=crop&q=80",
      tips: {
        es: "El shopping preferido de los locales para ropa y tecnología. Zona muy segura para caminar y tomar un café.",
        en: "The locals' favorite mall for clothing and tech. Very safe area with plenty of outdoor cafes nearby.",
        pt: "O shopping preferido dos locais para roupas e tecnologia. Bairro muito seguro para caminhar e tomar café."
      }
    },
    {
      id: "s3",
      category: "shopping",
      name: "Unicenter Shopping",
      neighborhood: "Zona Norte (Martínez)",
      lat: -34.5085,
      lng: -58.5235,
      price: "$$",
      tag: "El más grande de BsAs",
      image: "https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=600&auto=format&fit=crop&q=80",
      tips: {
        es: "El centro comercial más grande de la provincia. Ideal si querés pasar un día entero de compras sin gente apretada.",
        en: "The largest mall in greater Buenos Aires. Huge food court, hundreds of stores, perfect for a full shopping afternoon.",
        pt: "O maior shopping da região metropolitana. Centenas de lojas, praça de alimentação gigante e muito espaço."
      }
    },
    {
      id: "s4",
      category: "shopping",
      name: "Recoleta & Cementerio",
      neighborhood: "Recoleta",
      lat: -34.5874,
      lng: -58.3929,
      price: "$",
      tag: "Cultura & Arquitectura",
      image: "https://images.unsplash.com/photo-1589802829985-817e51171b92?w=600&auto=format&fit=crop&q=80",
      tips: {
        es: "Paseo arquitectónico imperdible. Mausoleo de Eva Perón. Los fines de semana hay feria artesanal en Plaza Francia.",
        en: "World-class cemetery and French architecture. Eva Peron's tomb. Great weekend artisan craft fair in Plaza Francia.",
        pt: "Passeio imperdível de arquitetura estilo parisiense. Túmulo de Eva Perón e feira de artesanato na Plaza Francia aos fins de semana."
      }
    }
  ],

  // Guía de supervivencia y seguridad
  guide: {
    money: {
      title: {
        es: "💵 Dinero y Pagos",
        en: "💵 Money & Currency",
        pt: "💵 Dinheiro e Câmbio"
      },
      text: {
        es: "En Argentina podés pagar con tarjeta extranjera (Visa/Mastercard) y te aplican el tipo de cambio oficial turístico (similar al Dólar MEP), muy conveniente. Si traés dólares en efectivo, cambiá únicamente en casas de cambio oficiales o agencias autorizadas; nunca en la vereda con desconocidos.",
        en: "Foreign credit cards (Visa/Mastercard) get the tourist MEP exchange rate, very close to the cash blue rate. If carrying cash USD, always use licensed exchange houses. Avoid street changers ('arbolitos') to avoid counterfeit bills.",
        pt: "Cartões internacionais recebem a cotação favorável MEP Turismo. Se trouxer dólares em espécie, troque apenas em casas de câmbio oficiais autorizadas; evite trocar na rua com desconhecidos."
      }
    },
    safety: {
      title: {
        es: "🛡️ Zonas Seguras y Consejos",
        en: "🛡️ Safety & Neighborhoods",
        pt: "🛡️ Segurança e Bairros"
      },
      text: {
        es: "🟢 Zonas muy tranquilas: Palermo, Recoleta, Puerto Madero y Belgrano.\n🟡 Zonas para ir atento de noche: San Telmo y Microcentro (guardar celular y bolso al caminar).\n🔴 Zonas para evitar de noche: Alrededores de las estaciones de trenes de Retiro y Constitución, y La Boca fuera del paseo turístico Caminito durante el día.",
        en: "🟢 Very safe: Palermo, Recoleta, Puerto Madero, Belgrano.\n🟡 Stay alert at night: San Telmo & Downtown (keep phones inside pockets).\n🔴 Avoid at night: Areas surrounding Retiro and Constitución train stations, and La Boca outside Caminito's marked pedestrian area.",
        pt: "🟢 Muito seguros: Palermo, Recoleta, Puerto Madero e Belgrano.\n🟡 Atenção redobrada à noite: San Telmo e Centro (celular sempre no bolso).\n🔴 Evitar à noite: Entorno das estações de trem Retiro e Constitución, e La Boca fora do circuito Caminito."
      }
    },
    transport: {
      title: {
        es: "🚗 Transporte y Movilidad",
        en: "🚗 Getting Around",
        pt: "🚗 Transporte e Locomoção"
      },
      text: {
        es: "La forma más cómoda y transparente de viajar es con Uber o DiDi, sabiendo la tarifa de antemano. Para subte y colectivos se necesita la tarjeta SUBE física. Para traslados largos al aeropuerto de Ezeiza, siempre conviene reservar un remís o chofer verificado.",
        en: "The safest way is using ride apps like Uber or DiDi so you know the upfront price. For subways and public buses you need a physical SUBE card. For airport trips to Ezeiza, always use verified private drivers or ride apps.",
        pt: "O jeito mais seguro e prático é usar Uber ou DiDi com preço fixo no app. Para metrô e ônibus é necessário o cartão físico SUBE. Para transfers até o aeroporto de Ezeiza, reserve sempre remís ou motorista de confiança."
      }
    },
    tipping: {
      title: {
        es: "🍽️ Propinas y Costumbres",
        en: "🍽️ Tipping & Dining Times",
        pt: "🍽️ Gorjetas e Horários"
      },
      text: {
        es: "La propina habitual en restaurantes es del 10% del total. Los locales suelen cenar tarde: los restaurantes empiezan a llenarse a partir de las 21:00 hs.",
        en: "Standard tipping in restaurants is 10%. Argentines dine late: dinner service peaks between 9:00 PM and 11:30 PM.",
        pt: "A gorjeta usual em restaurantes é de 10%. O jantar começa tarde: as mesas costumam encher a partir das 21h00."
      }
    }
  },

  // Traducciones de la interfaz
  i18n: {
    es: {
      appTitle: "BsAs Local Guide",
      subtitle: "Recomendaciones reales de mozos y anfitriones",
      recommendedBy: "Atendido por",
      tabMap: "Mapa en Vivo",
      tabTango: "Tango & Shows",
      tabGuide: "Tips & Seguridad",
      filterAll: "Todos",
      filterFood: "🥩 Parrillas & Pastas",
      filterTango: "💃 Tango",
      filterShopping: "🛍️ Shoppings",
      howToGetThere: "Cómo llegar a este lugar:",
      btnUber: "Pedir con Uber",
      btnDidi: "Pedir con DiDi",
      btnGoogleMaps: "Ver en Google Maps",
      btnDriver: "Pedir Chofer / Remís Seguro",
      bookTangoBtn: "Consultar Disponibilidad por WhatsApp",
      tangoBadge: "Comisión Verificada",
      yourLocation: "Estás acá",
      closeBtn: "Cerrar",
      searchPlaceholder: "Buscar parrilla, tango, shopping...",
      safetyBtnOn: "🛡️ Zonas Seguras: ON",
      safetyBtnOff: "🛡️ Zonas Seguras: OFF"
    },
    en: {
      appTitle: "BsAs Local Guide",
      subtitle: "Curated by local waiters and hosts",
      recommendedBy: "Hosted by",
      tabMap: "Live Map",
      tabTango: "Tango & Shows",
      tabGuide: "Tips & Safety",
      filterAll: "All",
      filterFood: "🥩 Steakhouses",
      filterTango: "💃 Tango",
      filterShopping: "🛍️ Malls & Sights",
      howToGetThere: "How to get there:",
      btnUber: "Ride with Uber",
      btnDidi: "Ride with DiDi",
      btnGoogleMaps: "Open in Google Maps",
      btnDriver: "Book Safe Private Driver",
      bookTangoBtn: "Book / Inquire via WhatsApp",
      tangoBadge: "Verified Partner",
      yourLocation: "You are here",
      closeBtn: "Close",
      searchPlaceholder: "Search steakhouse, tango, malls...",
      safetyBtnOn: "🛡️ Safety Zones: ON",
      safetyBtnOff: "🛡️ Safety Zones: OFF"
    },
    pt: {
      appTitle: "BsAs Local Guide",
      subtitle: "Dicas reais de garçons e anfitriões locais",
      recommendedBy: "Atendido por",
      tabMap: "Mapa ao Vivo",
      tabTango: "Tango & Shows",
      tabGuide: "Dicas & Segurança",
      filterAll: "Todos",
      filterFood: "🥩 Carnes e Massas",
      filterTango: "💃 Tango",
      filterShopping: "🛍️ Shoppings",
      howToGetThere: "Como chegar:",
      btnUber: "Ir de Uber",
      btnDidi: "Ir de DiDi",
      btnGoogleMaps: "Abrir no Google Maps",
      btnDriver: "Pedir Motorista Privado",
      bookTangoBtn: "Consultar Vagas no WhatsApp",
      tangoBadge: "Parceiro Verificado",
      yourLocation: "Você está aqui",
      closeBtn: "Fechar",
      searchPlaceholder: "Buscar churrascaria, tango, compras...",
      safetyBtnOn: "🛡️ Zonas Seguras: ON",
      safetyBtnOff: "🛡️ Zonas Seguras: OFF"
    }
  }
};

