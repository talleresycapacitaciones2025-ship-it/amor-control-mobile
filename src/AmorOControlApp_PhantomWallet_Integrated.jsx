import React, { useEffect, useMemo, useState } from "react";
import nacl from "tweetnacl";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  clusterApiUrl
} from "@solana/web3.js";

const APP_NAME = "¿Amor o control?";

const ICONS = {
  home: "⌂",
  shield: "🛡️",
  eye: "◉",
  heart: "♥",
  book: "▤",
  brain: "✺",
  checklist: "☑",
  users: "◌◌",
  wallet: "▣",
  warning: "!",
  lock: "🔒",
  phone: "☎",
  spark: "✦",
  vault: "▥",
  map: "⌁",
  reply: "↗",
  guardian: "◆",
  exit: "×",
  plus: "+"
};

const INITIAL_SCANNER_TEXT = "Me pidió mi ubicación todo el día y se enoja si no le mando captura de con quién estoy.";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function Icon({ name, className = "" }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-white/80 text-base font-black shadow-sm ring-1 ring-white/60",
        className
      )}
    >
      {ICONS[name] || "•"}
    </span>
  );
}

function Card({ children, className = "" }) {
  return (
    <div
      className={cx(
        "rounded-[1.75rem] border border-white/25 bg-white/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl transition duration-300 hover:shadow-[0_24px_80px_rgba(15,23,42,0.18)]",
        className
      )}
    >
      {children}
    </div>
  );
}

function Section({ children }) {
  return <main className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>;
}

function Button({ children, onClick, variant = "primary", className = "", type = "button", disabled = false }) {
  const base = "rounded-2xl px-5 py-3 text-sm font-black shadow-sm transition hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40";
  const variants = {
    primary: "bg-slate-950 text-white shadow-lg hover:bg-slate-800",
    secondary: "border border-slate-200 bg-white/90 text-slate-800 hover:bg-white",
    ghost: "border border-white/50 bg-white/20 text-current hover:bg-white/35"
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cx(base, variants[variant], className)}>
      {children}
    </button>
  );
}

function Badge({ children, className = "" }) {
  return (
    <span className={cx("inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/80 px-3 py-1 text-xs font-black shadow-sm", className)}>
      {children}
    </span>
  );
}

function Input({ label, value, onChange, placeholder = "", type = "text" }) {
  return (
    <label className="block">
      <span className="text-sm font-black text-slate-800">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50/90 p-3 text-sm outline-none transition focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-100"
      />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder = "", rowsClass = "min-h-[110px]" }) {
  return (
    <label className="block">
      <span className="text-sm font-black text-slate-800">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cx(
          "mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50/90 p-3 text-sm shadow-inner outline-none transition focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-100",
          rowsClass
        )}
      />
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="text-sm font-black text-slate-800">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50/90 p-3 text-sm outline-none transition focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-100"
      >
        {options.map((option) => (
          <option key={option.value || option} value={option.value || option}>
            {option.label || option}
          </option>
        ))}
      </select>
    </label>
  );
}

const SEVERITY = {
  green: {
    label: "Verde",
    title: "Señales saludables o sin alerta clara",
    subtitle: "Respeto, autonomía, límites y comunicación.",
    score: 0,
    tone: "border-emerald-200 bg-emerald-50/90 text-emerald-950",
    dot: "bg-emerald-500"
  },
  yellow: {
    label: "Amarillo",
    title: "Precaución: observa el patrón",
    subtitle: "Incomodidad, presión leve o conflictos repetidos.",
    score: 1,
    tone: "border-amber-200 bg-amber-50/90 text-amber-950",
    dot: "bg-amber-500"
  },
  orange: {
    label: "Naranja",
    title: "Riesgo moderado: busca apoyo y cuida tus límites",
    subtitle: "Control, aislamiento, invasión digital o humillación.",
    score: 2,
    tone: "border-orange-200 bg-orange-50/90 text-orange-950",
    dot: "bg-orange-500"
  },
  red: {
    label: "Rojo",
    title: "Alerta alta: prioriza seguridad",
    subtitle: "Amenazas, miedo, violencia física, sexual o sextorsión.",
    score: 3,
    tone: "border-rose-200 bg-rose-50/90 text-rose-950",
    dot: "bg-rose-500"
  }
};

const RULES = [
  {
    category: "Violencia digital o vigilancia",
    severity: "orange",
    words: ["ubicacion", "localizacion", "gps", "contrasena", "clave", "celular", "whatsapp", "redes", "instagram", "facebook", "revisar", "revisa", "vigila", "monitorea", "stalking", "captura"],
    explanation: "Pedir ubicación, claves, capturas, revisar redes o vigilar actividad digital puede limitar tu privacidad y autonomía. La confianza no necesita contraseña; el control sí.",
    steps: ["Revisa sesiones abiertas desde un dispositivo seguro.", "Cambia contraseñas y activa doble factor de autenticación.", "Evita confrontar si temes una reacción violenta."]
  },
  {
    category: "Sextorsión o contenido íntimo",
    severity: "red",
    words: ["foto intima", "fotos intimas", "nudes", "pack", "sextorsion", "chantaje", "difundir", "publicar mis fotos", "contenido intimo", "video intimo", "desnuda", "desnudo"],
    explanation: "Amenazar con difundir contenido íntimo, presionar para enviarlo o usar imágenes privadas para controlar es una forma grave de violencia digital y sexual.",
    steps: ["No envíes más material bajo presión.", "Guarda evidencias solo si no aumenta tu riesgo.", "Busca apoyo de una persona segura o servicios especializados."]
  },
  {
    category: "Aislamiento social",
    severity: "orange",
    words: ["no quiere que vea", "mis amigas", "mis amigos", "mi familia", "me aleja", "me aislo", "dejar de hablar", "no me deja salir", "me prohibe salir", "se molesta cuando salgo"],
    explanation: "El aislamiento reduce tus redes de apoyo y puede aumentar dependencia. Una pareja sana no te obliga a desaparecer de tu propia vida.",
    steps: ["Identifica una persona segura.", "Retoma contacto con alguien de confianza de forma discreta.", "Observa si aparece culpa, miedo o amenazas."]
  },
  {
    category: "Celos coercitivos o control",
    severity: "orange",
    words: ["celos", "celoso", "celosa", "me cela", "con quien hablo", "me pide pruebas", "me exige fotos", "me controla", "me interroga", "se enoja si no respondo", "me reclama"],
    explanation: "Los celos se vuelven señal de alerta cuando implican vigilancia, interrogatorio, castigo o exigencia de pruebas.",
    steps: ["Diferencia cuidado de control: cuidar respeta tu libertad; controlar la reduce.", "Observa frecuencia, intensidad e impacto emocional.", "Habla con alguien de confianza si esto se repite."]
  },
  {
    category: "Humillación o violencia verbal",
    severity: "orange",
    words: ["me insulta", "me humilla", "me ridiculiza", "me grita", "me dice loca", "me dice loco", "exagerada", "exagerado", "se burla", "me desprecia", "me invalida"],
    explanation: "Insultos, gritos, humillaciones o burlas constantes no son comunicación difícil: pueden dañar tu autoestima y tu confianza en tu propio criterio.",
    steps: ["Registra brevemente qué ocurrió y cómo te hizo sentir.", "Pregúntate si puedes poner límites sin recibir castigo emocional.", "Busca apoyo si las humillaciones se repiten o escalan."]
  },
  {
    category: "Manipulación o gaslighting",
    severity: "orange",
    words: ["estas loca", "estas loco", "eso nunca paso", "te inventas", "dramatica", "dramatico", "me hace dudar", "me confunde", "siempre es mi culpa", "exageras"],
    explanation: "Cuando alguien niega sistemáticamente lo que viviste, te llama exagerada/o o te hace desconfiar de tu percepción, puede haber manipulación emocional.",
    steps: ["Escribe una versión breve de los hechos para recuperar claridad.", "Contrasta la situación con una persona segura.", "Tu malestar merece atención aunque la otra persona lo minimice."]
  },
  {
    category: "Amenazas o intimidación",
    severity: "red",
    words: ["amenaza", "me amenazo", "me amenaza", "hacerme dano", "matarme", "se va a matar", "suicidarse", "si termino", "si lo dejo", "me persigue", "me espera afuera", "me da miedo"],
    explanation: "Amenazas, persecución, intimidación o miedo por tu seguridad son señales de alerta alta. Aquí la prioridad no es discutir la relación: es cuidar tu integridad.",
    steps: ["No enfrentes sola/o a la persona si temes una reacción peligrosa.", "Contacta a alguien de confianza y acuerda una palabra clave.", "Busca apoyo especializado o servicios de emergencia si hay riesgo inmediato."]
  },
  {
    category: "Violencia física o sexual",
    severity: "red",
    words: ["me pego", "golpe", "empujo", "me sujeto", "me forzo", "me obligo", "sexo sin querer", "toco sin permiso", "me presiona sexualmente", "me lastimo"],
    explanation: "Golpes, empujones, sujeción, coerción sexual o cualquier contacto sexual sin consentimiento son señales de alto riesgo. Tu seguridad física y sexual va primero.",
    steps: ["Busca un lugar seguro y contacta a alguien de confianza.", "Si hay lesiones o riesgo inmediato, acude a servicios de emergencia o protección.", "No necesitas tener todo claro para pedir ayuda: basta con que estés en riesgo o tengas miedo."]
  },
  {
    category: "Relación saludable",
    severity: "green",
    words: ["respeta mis limites", "me escucha", "hablamos con respeto", "me apoya", "confia en mi", "me da espacio", "puedo decir que no", "resolvemos hablando", "respeta mi tiempo"],
    explanation: "Comunicación respetuosa, apoyo mutuo, confianza, empatía y límites respetados son señales de una relación saludable.",
    steps: ["Sostén acuerdos claros y revisables.", "Observa si el respeto se mantiene también en los desacuerdos.", "Una relación sana permite conflicto sin destruir dignidad ni libertad."]
  }
];

const MODULES = [
  {
    id: "healthy",
    title: "Relaciones saludables",
    icon: "heart",
    summary: "Una relación sana combina comunicación abierta, apoyo mutuo, empatía, límites respetados y resolución constructiva de conflictos.",
    bullets: ["Puedes decir que no sin miedo.", "Tus amistades, estudios, trabajo y descanso no son una amenaza.", "El conflicto se conversa, no se castiga.", "La confianza no exige pruebas permanentes."]
  },
  {
    id: "redflags",
    title: "Red flags y escalamiento",
    icon: "warning",
    summary: "El control suele empezar como intensidad, preocupación o celos románticos. El patrón importa más que una promesa bonita.",
    bullets: ["Controlar ropa, horarios, redes o amistades no es cuidado.", "La humillación repetida debilita tu criterio y autoestima.", "Las amenazas cambian la prioridad: seguridad antes que discusión.", "La violencia no se justifica por amor, trauma o celos."]
  },
  {
    id: "digital",
    title: "Violencia digital",
    icon: "eye",
    summary: "La tecnología puede convertirse en herramienta de vigilancia, coerción o humillación. La privacidad también es un límite relacional.",
    bullets: ["No tienes que entregar contraseñas para demostrar amor.", "Pedir ubicación constante puede ser vigilancia, no cuidado.", "Difundir o amenazar con difundir contenido íntimo es grave.", "Revisa sesiones abiertas y activa doble factor de autenticación."]
  },
  {
    id: "trauma",
    title: "Primer apoyo emocional",
    icon: "brain",
    summary: "En momentos de crisis, la prioridad es estabilizar, validar y conectar con apoyo; no obligarte a decidir todo de inmediato.",
    bullets: ["Primero: ¿estás en un lugar seguro?", "Segundo: respira y ubica una persona de confianza.", "Tercero: define un siguiente paso pequeño y seguro.", "No tienes que relatar detalles para merecer ayuda."]
  },
  {
    id: "ecological",
    title: "Enfoque ecológico",
    icon: "users",
    summary: "La violencia no aparece en el vacío: intervienen factores individuales, relacionales, comunitarios y sociales.",
    bullets: ["Individual: culpa, miedo, confusión, ansiedad.", "Relacional: celos, control, aislamiento y amenazas.", "Comunitario: redes de apoyo, universidad, salud y pares.", "Social: mitos del amor romántico y desigualdad de género."]
  },
  {
    id: "rights",
    title: "Derechos y autonomía",
    icon: "shield",
    summary: "Vivir sin violencia, decidir sobre tu cuerpo, mantener privacidad y conservar redes de apoyo son derechos, no premios por portarte bien.",
    bullets: ["Tu libertad no debe negociarse con culpa.", "Tu privacidad digital importa.", "Tu orientación, identidad y proyecto de vida merecen respeto.", "Pedir ayuda es autocuidado, no traición."]
  }
];

const MYTHS = [
  ["Me cela porque me quiere.", "El amor puede incluir interés; el control exige pruebas. Los celos que vigilan, prohíben o castigan son alerta."],
  ["Si no tengo nada que ocultar, debería darle mi clave.", "La privacidad no es sospecha. Una relación sana respeta límites digitales."],
  ["Me gritó, pero después pidió perdón.", "La disculpa importa solo si hay reparación y cambio sostenido. El ciclo de daño y promesa también puede atrapar."],
  ["Si cambio, la relación va a mejorar.", "Puedes trabajar en ti, pero no puedes controlar la decisión de otra persona de respetarte o dañarte."]
];

const QUIZ = [
  {
    q: "Tu pareja te pide ubicación todo el día y se enoja si no respondes rápido.",
    options: ["Cuidado", "Control", "Indiferencia"],
    answer: "Control",
    feedback: "La ubicación constante y el enojo por no responder pueden funcionar como vigilancia digital."
  },
  {
    q: "Tu pareja acepta que estudies, descanses o salgas con amistades aunque te extrañe.",
    options: ["Green flag", "Red flag", "Manipulación"],
    answer: "Green flag",
    feedback: "Respetar tiempos, amistades y proyectos personales es una señal saludable."
  },
  {
    q: "Después de cada discusión, te dice que todo fue tu culpa y que estás exagerando.",
    options: ["Conflicto sano", "Gaslighting o manipulación", "Comunicación abierta"],
    answer: "Gaslighting o manipulación",
    feedback: "Culparte sistemáticamente y negar tu malestar puede hacerte dudar de tu percepción."
  }
];

const EVENT_TYPES = ["Control digital", "Celos coercitivos", "Aislamiento", "Humillación", "Amenaza", "Violencia física", "Violencia sexual", "Sextorsión", "Otro"];
const IMPACTS = ["Miedo", "Ansiedad", "Culpa", "Confusión", "Vergüenza", "Presión", "Tranquilidad", "Otro"];

function analyzeText(text, checklist) {
  const normalized = normalizeText(text);
  const hits = [];

  RULES.forEach((rule) => {
    const found = rule.words.some((word) => normalized.includes(normalizeText(word)));
    if (found) hits.push(rule);
  });

  if (checklist.fear) {
    hits.push({ category: "Miedo o inseguridad", severity: "red", explanation: "Sentir miedo de la reacción de tu pareja eleva el nivel de alerta y requiere priorizar seguridad.", steps: ["Busca apoyo fuera de la relación.", "Evita confrontar si hay riesgo de escalamiento."] });
  }
  if (checklist.repetition) {
    hits.push({ category: "Patrón repetido", severity: "orange", explanation: "La repetición transforma un hecho aislado en un patrón que merece atención.", steps: ["Registra frecuencia e impacto.", "Contrasta con una persona segura."] });
  }
  if (checklist.isolation) {
    hits.push({ category: "Red de apoyo reducida", severity: "orange", explanation: "Quedarte sin redes de apoyo puede aumentar dependencia y riesgo.", steps: ["Recupera un contacto seguro.", "Define una palabra clave."] });
  }
  if (checklist.threat) {
    hits.push({ category: "Amenaza explícita", severity: "red", explanation: "Las amenazas directas o indirectas son señales de alerta alta.", steps: ["Prioriza un plan de seguridad.", "Busca ayuda inmediata si hay peligro."] });
  }
  if (checklist.sexualPressure) {
    hits.push({ category: "Presión sexual", severity: "red", explanation: "La presión sexual o el contacto sin consentimiento son señales de alto riesgo.", steps: ["Busca apoyo seguro.", "No tienes que justificar tu negativa."] });
  }

  if (!normalized && hits.length === 0) {
    return { severity: "green", categories: [], explanation: "Escribe una frase o situación para recibir orientación psicoeducativa.", steps: [], questions: [] };
  }

  if (normalized && hits.length === 0) {
    hits.push({ category: "Situación no concluyente", severity: "yellow", explanation: "No aparecen señales claras en el texto, pero si algo te incomoda, vale la pena observar frecuencia, impacto y posibilidad de poner límites sin miedo.", steps: ["Observa si se repite.", "Pregúntate si puedes hablar sin temor.", "Habla con una persona segura si necesitas claridad."] });
  }

  const severity = hits.reduce((max, hit) => (SEVERITY[hit.severity].score > SEVERITY[max].score ? hit.severity : max), "green");
  const categories = Array.from(new Set(hits.map((hit) => hit.category)));
  const steps = Array.from(new Set(hits.flatMap((hit) => hit.steps || []))).slice(0, 5);

  return {
    severity,
    categories,
    explanation: hits[0].explanation,
    steps,
    questions: [
      "¿Esto ocurrió una vez o se repite?",
      "¿Puedes decir que no sin miedo?",
      "¿Tu privacidad digital está siendo respetada?",
      "¿Has dejado amistades o actividades por evitar conflictos?",
      "¿Tienes una persona segura con quien hablar hoy?"
    ]
  };
}

function useSafeLocalStorage(key, initialValue) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored) setValue(JSON.parse(stored));
    } catch (error) {
      // Local storage may be disabled in some browsers or preview sandboxes.
    }
  }, [key]);

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // In production, use encrypted storage, PIN/biometrics, and safe deletion.
    }
  }, [key, value]);

  return [value, setValue];
}

function downloadText(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function sha256(text) {
  try {
    if (window.crypto && window.crypto.subtle) {
      const data = new TextEncoder().encode(text);
      const buffer = await window.crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(buffer))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch (error) {
    // Fallback below.
  }

  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (Math.imul(31, hash) + text.charCodeAt(index)) | 0;
  }
  return "demo-" + Math.abs(hash).toString(16);
}

function QuickExit() {
  return (
    <button
      onClick={() => {
        window.location.href = "https://www.google.com/search?q=clima";
      }}
      className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-full border border-white/70 bg-white/95 px-4 py-2 text-sm font-black text-slate-700 shadow-[0_16px_50px_rgba(15,23,42,0.22)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white"
      aria-label="Salida rápida"
    >
      <span className="grid h-5 w-5 place-items-center rounded-full bg-slate-100 text-base leading-none">×</span>
      Salida rápida
    </button>
  );
}

function Header({ active, setActive }) {
  const tabs = [
    ["home", "Inicio", "home"],
    ["scanner", "Scanner", "eye"],
    ["guardian", "Guardian", "guardian"],
    ["vault", "Bodega", "vault"],
    ["reply", "Respuestas", "reply"],
    ["map", "Mapa", "map"],
    ["learn", "Aprender", "book"],
    ["support", "Primer apoyo", "brain"],
    ["plan", "Plan", "checklist"],
    ["community", "Comunidad", "users"],
    ["solana", "Solana", "wallet"]
  ];

  return (
    <header className="relative z-10 mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-[2rem] border border-white/15 bg-white/80 shadow-[0_24px_80px_rgba(2,6,23,0.28)] backdrop-blur-2xl">
        <div className="grid gap-6 p-6 md:grid-cols-[1.35fr_.65fr] md:p-8">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-black text-teal-900 shadow-sm">
              <Icon name="shield" className="h-6 w-6 rounded-xl bg-teal-100 shadow-none" />
              App psicoeducativa, preventiva y segura
            </div>
            <h1 className="max-w-4xl text-4xl font-black leading-[0.95] tracking-tight text-slate-950 md:text-6xl">{APP_NAME}</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
              Demo integral: detecta señales, activa Guardian Mode, organiza evidencia, muestra patrones, enseña respuestas seguras y usa Solana sin exponer datos sensibles.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={() => setActive("scanner")}>Analizar una situación</Button>
              <Button variant="secondary" onClick={() => setActive("guardian")}>Activar Guardian Mode</Button>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/50 bg-gradient-to-br from-teal-50 via-white to-indigo-50 p-5 shadow-inner">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Diferencial hackathon</p>
            <div className="mt-4 space-y-3">
              {["Scanner + Guardian Mode", "Bodega Segura con hash verificable", "Simulador de respuestas seguras", "Mapa de Escalada + Proof of Care"].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/60 bg-white/75 px-4 py-3 text-sm text-slate-700 shadow-sm">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-teal-100 text-xs font-black text-teal-800">✓</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto border-t border-slate-100 bg-white/70 p-3">
          {tabs.map(([id, label, icon]) => {
            const selected = active === id;
            return (
              <button
                key={id}
                onClick={() => setActive(id)}
                className={cx(
                  "flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black transition",
                  selected ? "bg-slate-950 text-white shadow-md" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <span className={cx("inline-grid h-6 w-6 place-items-center rounded-xl", selected ? "bg-white/15" : "bg-slate-100")}>{ICONS[icon]}</span>
                {label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

function Home({ setActive }) {
  const featureCards = [
    ["eye", "Red Flags Scanner", "Clasifica frases o situaciones sin diagnosticar personas.", "scanner"],
    ["guardian", "Guardian Mode", "Activa mensajes seguros, guía para contactos y salida discreta.", "guardian"],
    ["vault", "Bodega Segura", "Ordena evidencia, genera línea de tiempo y hash de integridad.", "vault"],
    ["reply", "Respuestas seguras", "Sugiere mensajes neutrales, límites y salida sin escalar riesgo.", "reply"],
    ["map", "Mapa de Escalada", "Detecta patrones temporales: control + aislamiento + miedo.", "map"],
    ["wallet", "Proof of Care", "Badge educativo en Solana sin guardar trauma en blockchain.", "solana"]
  ];

  return (
    <Section>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge className="text-teal-900">{ICONS.spark} arquitectura ética de prevención</Badge>
              <h2 className="mt-4 text-2xl font-black text-slate-950">Qué hace esta app</h2>
            </div>
            <div className="hidden rounded-3xl bg-gradient-to-br from-teal-100 to-indigo-100 p-4 text-3xl shadow-inner md:block">🛡️</div>
          </div>
          <p className="mt-3 leading-7 text-slate-600">
            No es solo un chatbot. Es un flujo completo: detecta señales, regula la activación emocional, activa apoyo seguro, organiza evidencia, visualiza patrones y reconoce aprendizaje preventivo sin exponer datos sensibles.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featureCards.map(([icon, title, text, tab]) => (
              <button key={title} onClick={() => setActive(tab)} className="group rounded-2xl border border-slate-100 bg-slate-50/80 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md">
                <Icon name={icon} className="text-teal-700" />
                <h3 className="mt-3 font-black text-slate-900">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">{text}</p>
              </button>
            ))}
          </div>
        </Card>

        <Card className="relative overflow-hidden bg-slate-950 text-white">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-teal-400/20 blur-3xl" />
          <div className="relative">
            <Icon name="lock" className="bg-white/10 text-teal-100 ring-white/10" />
            <h2 className="mt-4 text-xl font-black">Límites no negociables</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-200">
              <li>✓ No diagnostica ni etiqueta a la pareja.</li>
              <li>✓ No reemplaza terapia, servicios legales ni emergencia.</li>
              <li>✓ No guarda datos sensibles en blockchain.</li>
              <li>✓ No presiona a terminar: prioriza seguridad y agencia.</li>
              <li>✓ No convierte evidencia en espectáculo. Gracias, humanidad.</li>
            </ul>
            <button onClick={() => setActive("learn")} className="mt-6 rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-950 shadow-lg transition hover:-translate-y-0.5">
              Ver módulos educativos →
            </button>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-4">
        {Object.entries(SEVERITY).map(([key, item]) => (
          <Card key={key} className={cx(item.tone, "relative overflow-hidden")}>
            <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-white/35 blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-3">
                <span className={cx("h-3.5 w-3.5 rounded-full ring-4 ring-white/50", item.dot)} />
                <p className="text-base font-black">{item.label}</p>
              </div>
              <p className="mt-3 text-sm font-bold leading-6">{item.title}</p>
              <p className="mt-2 text-xs leading-5 opacity-80">{item.subtitle}</p>
            </div>
          </Card>
        ))}
      </div>
    </Section>
  );
}


const THERMOMETER_LEVELS = [
  {
    key: "red",
    label: "Rojo",
    short: "Alerta alta",
    temperature: "90–100%",
    examples: ["amenazas", "sextorsión", "miedo", "violencia física o sexual"],
    message: "Prioriza seguridad. Evita confrontar si hay peligro y activa apoyo seguro.",
    buttonClass: "border-rose-300 bg-rose-50 text-rose-950",
    dotClass: "bg-rose-500",
    barClass: "bg-rose-500",
    textClass: "text-rose-900",
    ringClass: "ring-rose-200"
  },
  {
    key: "orange",
    label: "Naranja",
    short: "Riesgo moderado",
    temperature: "65–89%",
    examples: ["control digital", "humillación", "aislamiento", "celos coercitivos"],
    message: "Observa patrón, registra hechos y habla con una persona segura.",
    buttonClass: "border-orange-300 bg-orange-50 text-orange-950",
    dotClass: "bg-orange-500",
    barClass: "bg-orange-500",
    textClass: "text-orange-900",
    ringClass: "ring-orange-200"
  },
  {
    key: "yellow",
    label: "Amarillo",
    short: "Precaución",
    temperature: "35–64%",
    examples: ["presión leve", "incomodidad", "insistencia", "conflictos repetidos"],
    message: "Aclara límites y revisa si puedes decir que no sin recibir castigo.",
    buttonClass: "border-amber-300 bg-amber-50 text-amber-950",
    dotClass: "bg-amber-500",
    barClass: "bg-amber-500",
    textClass: "text-amber-900",
    ringClass: "ring-amber-200"
  },
  {
    key: "green",
    label: "Verde",
    short: "Comunicación segura",
    temperature: "0–34%",
    examples: ["respeto", "confianza", "límites", "autonomía"],
    message: "Hay señales compatibles con respeto y cuidado. Mantén acuerdos claros.",
    buttonClass: "border-emerald-300 bg-emerald-50 text-emerald-950",
    dotClass: "bg-emerald-500",
    barClass: "bg-emerald-500",
    textClass: "text-emerald-900",
    ringClass: "ring-emerald-200"
  }
];

const THERMOMETER_FILL = {
  green: 22,
  yellow: 48,
  orange: 74,
  red: 100
};

const THERMOMETER_GRADIENT = {
  green: "linear-gradient(to top, rgb(16 185 129), rgb(52 211 153))",
  yellow: "linear-gradient(to top, rgb(16 185 129), rgb(245 158 11))",
  orange: "linear-gradient(to top, rgb(16 185 129), rgb(245 158 11), rgb(249 115 22))",
  red: "linear-gradient(to top, rgb(16 185 129), rgb(245 158 11), rgb(249 115 22), rgb(244 63 94))"
};

function RiskThermometer({ result, currentSeverity }) {
  const [selectedLevel, setSelectedLevel] = useState(currentSeverity);

  useEffect(() => {
    setSelectedLevel(currentSeverity);
  }, [currentSeverity]);

  const activeLevel = THERMOMETER_LEVELS.find((level) => level.key === selectedLevel) || THERMOMETER_LEVELS[3];
  const detectedLevel = THERMOMETER_LEVELS.find((level) => level.key === currentSeverity) || THERMOMETER_LEVELS[3];
  const fillHeight = THERMOMETER_FILL[currentSeverity] || 22;
  const detectedCategories = result.categories.length > 0 ? result.categories.join(" · ") : "Sin categorías activas todavía";

  return (
    <div className="mt-5 rounded-[1.5rem] border border-slate-100 bg-gradient-to-br from-slate-50 via-white to-slate-50 p-4 shadow-inner">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Termómetro de riesgo comunicacional</p>
          <h3 className="mt-1 text-lg font-black text-slate-950">Violentómetro interactivo preventivo</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Cambia automáticamente según el texto y las casillas marcadas. También puedes tocar cada color para ver qué significa.
          </p>
        </div>
        <Badge className={cx("border-white/70", detectedLevel.buttonClass)}>Detectado: {detectedLevel.label}</Badge>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-[130px_1fr]">
        <div className="flex items-center justify-center">
          <div className="relative h-72 w-24 rounded-full border border-white/80 bg-white p-3 shadow-[0_18px_45px_rgba(15,23,42,0.12)]">
            <div className="absolute -left-2 top-4 flex h-56 flex-col justify-between text-[10px] font-black text-slate-400">
              <span>100</span>
              <span>75</span>
              <span>50</span>
              <span>25</span>
              <span>0</span>
            </div>
            <div className="relative mx-auto h-56 w-10 overflow-hidden rounded-full border border-slate-200 bg-slate-100 shadow-inner">
              <div
                className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-700 ease-out"
                style={{ height: `${fillHeight}%`, background: THERMOMETER_GRADIENT[currentSeverity] }}
              />
              <div className="absolute inset-x-0 top-0 h-10 bg-white/35 blur-sm" />
            </div>
            <div
              className={cx(
                "mx-auto -mt-1 grid h-16 w-16 place-items-center rounded-full text-xl font-black text-white shadow-lg ring-8 transition duration-700",
                detectedLevel.barClass,
                detectedLevel.ringClass
              )}
            >
              {detectedLevel.label[0]}
            </div>
            <div className="mt-3 text-center">
              <p className={cx("text-sm font-black", detectedLevel.textClass)}>{detectedLevel.short}</p>
              <p className="text-[11px] font-bold text-slate-500">{detectedLevel.temperature}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {THERMOMETER_LEVELS.map((level) => (
              <button
                key={level.key}
                type="button"
                onClick={() => setSelectedLevel(level.key)}
                aria-pressed={selectedLevel === level.key}
                className={cx(
                  "rounded-2xl border p-3 text-left shadow-sm transition hover:-translate-y-0.5",
                  selectedLevel === level.key ? level.buttonClass : "border-slate-200 bg-white/80 text-slate-700 hover:bg-white"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={cx("h-3 w-3 rounded-full ring-4 ring-white", level.dotClass)} />
                  <span className="text-sm font-black">{level.label}</span>
                  {currentSeverity === level.key && <span className="ml-auto rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-black shadow-sm">actual</span>}
                </div>
                <p className="mt-1 text-xs font-bold opacity-80">{level.short}</p>
              </button>
            ))}
          </div>

          <div className={cx("rounded-2xl border p-4 shadow-sm", activeLevel.buttonClass)}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-black">Nivel seleccionado: {activeLevel.label}</p>
              <span className="rounded-full bg-white/70 px-2 py-1 text-[11px] font-black shadow-sm">{activeLevel.temperature}</span>
            </div>
            <p className="mt-2 text-sm leading-6">{activeLevel.message}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {activeLevel.examples.map((example) => (
                <span key={example} className="rounded-full border border-white/70 bg-white/75 px-3 py-1 text-[11px] font-black shadow-sm">
                  {example}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm leading-6 text-slate-700 shadow-sm">
            <p className="font-black text-slate-900">Lectura dinámica de esta comunicación</p>
            <p className="mt-1">{detectedCategories}</p>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100 shadow-inner">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${fillHeight}%`, background: THERMOMETER_GRADIENT[currentSeverity] }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Este indicador es psicoeducativo: no diagnostica personas ni sustituye atención profesional, legal o de emergencia.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Scanner({ setActive }) {
  const [text, setText] = useState(INITIAL_SCANNER_TEXT);
  const [checklist, setChecklist] = useState({ fear: false, repetition: true, isolation: false, threat: false, sexualPressure: false });
  const result = useMemo(() => analyzeText(text, checklist), [text, checklist]);
  const severity = SEVERITY[result.severity];
  const checks = [
    ["repetition", "Esto se repite"],
    ["fear", "Me da miedo su reacción"],
    ["isolation", "He reducido mi red de apoyo"],
    ["threat", "Hay amenazas"],
    ["sexualPressure", "Hay presión sexual"]
  ];

  return (
    <Section>
      <div className="grid gap-6 lg:grid-cols-[1fr_.85fr]">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge className="text-slate-600">{ICONS.eye} análisis preventivo</Badge>
              <h2 className="mt-4 text-2xl font-black text-slate-950">Red Flags Scanner</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Escribe una frase, conducta o situación. La app analiza señales observables y devuelve orientación preventiva.</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4 text-3xl shadow-inner">◉</div>
          </div>

          <TextArea
            label="Situación a analizar"
            value={text}
            onChange={setText}
            rowsClass="min-h-[180px]"
            placeholder="Ejemplo: mi pareja revisa mi celular, me pide ubicación, me culpa cuando salgo..."
          />

          <RiskThermometer result={result} currentSeverity={result.severity} />

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {checks.map(([key, label]) => (
              <button
                key={key}
                onClick={() => setChecklist((prev) => ({ ...prev, [key]: !prev[key] }))}
                className={cx(
                  "rounded-2xl border p-3 text-left text-sm font-black shadow-sm transition hover:-translate-y-0.5",
                  checklist[key] ? "border-teal-300 bg-teal-50 text-teal-950" : "border-slate-200 bg-white/90 text-slate-700 hover:bg-white"
                )}
              >
                <span className={cx("mr-2 inline-grid h-5 w-5 place-items-center rounded-full text-xs", checklist[key] ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-400")}>
                  {checklist[key] ? "✓" : "○"}
                </span>
                {label}
              </button>
            ))}
          </div>
        </Card>

        <Card className={cx(severity.tone, "relative overflow-hidden")}>
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/25 blur-2xl" />
          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className={cx("h-4 w-4 rounded-full ring-4 ring-white/50", severity.dot)} />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] opacity-80">Nivel {severity.label}</p>
                  <h3 className="text-xl font-black">{severity.title}</h3>
                </div>
              </div>
              <div className="rounded-2xl bg-white/50 px-3 py-2 font-black shadow-sm">{ICONS.warning}</div>
            </div>

            <div className="mt-5 rounded-2xl border border-white/50 bg-white/70 p-4 shadow-sm">
              <p className="text-sm font-black">Lectura psicoeducativa</p>
              <p className="mt-2 text-sm leading-6">{result.explanation}</p>
            </div>

            {result.categories.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-black">Categorías detectadas</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {result.categories.map((category) => (
                    <span key={category} className="rounded-full border border-white/60 bg-white/80 px-3 py-1 text-xs font-black shadow-sm">{category}</span>
                  ))}
                </div>
              </div>
            )}

            {result.steps.length > 0 && (
              <div className="mt-5 rounded-2xl border border-white/50 bg-white/70 p-4 shadow-sm">
                <p className="text-sm font-black">Siguientes pasos seguros</p>
                <ul className="mt-3 space-y-2 text-sm leading-6">
                  {result.steps.map((step) => (
                    <li key={step} className="flex gap-2">
                      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black shadow-sm">✓</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-5 rounded-2xl border border-white/50 bg-white/70 p-4 shadow-sm">
              <p className="text-sm font-black">Preguntas de claridad</p>
              <div className="mt-2 space-y-2 text-sm leading-6">
                {result.questions.map((question) => <p key={question}>• {question}</p>)}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={() => setActive("guardian")} className="px-4 py-2">Activar Guardian</Button>
              <Button variant="secondary" onClick={() => setActive("support")} className="border-white/60 bg-white/80 px-4 py-2">Necesito calmarme</Button>
              <Button variant="secondary" onClick={() => setActive("vault")} className="border-white/60 bg-white/80 px-4 py-2">Guardar evidencia</Button>
            </div>
          </div>
        </Card>
      </div>
    </Section>
  );
}

function GuardianMode() {
  const [safeContact, setSafeContact] = useState("Mi persona segura");
  const [codeWord, setCodeWord] = useState("¿Me mandas el archivo?");
  const [scenario, setScenario] = useState("call");
  const [copied, setCopied] = useState(false);
  const [neutral, setNeutral] = useState(false);

  const messages = {
    call: `Hola, ${safeContact}. ¿Puedes llamarme en 5 minutos y decir que necesitas hablar conmigo? No quiero explicar por mensaje, pero necesito salir de esta situación.`,
    code: codeWord,
    pickup: `Hola, ${safeContact}. ¿Puedes pasar por mí o ayudarme a pedir transporte? Necesito salir de donde estoy sin dar explicaciones.`,
    check: `Hola, ${safeContact}. Si no te respondo en 20 minutos, por favor llámame. Necesito que alguien sepa que no me siento segura/o.`
  };

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(messages[scenario]);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch (error) {
      setCopied(false);
    }
  }

  if (neutral) {
    return (
      <Section>
        <Card className="min-h-[520px] bg-white text-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Notas</p>
              <h2 className="text-2xl font-black">Lista de pendientes</h2>
            </div>
            <button onClick={() => setNeutral(false)} className="rounded-full bg-slate-100 px-3 py-1 text-sm font-black">volver</button>
          </div>
          <div className="mt-6 space-y-3 text-slate-600">
            <p>• Comprar café</p>
            <p>• Revisar clima</p>
            <p>• Enviar documento</p>
            <p>• Cargar celular</p>
          </div>
        </Card>
      </Section>
    );
  }

  return (
    <Section>
      <div className="grid gap-6 lg:grid-cols-[1fr_.9fr]">
        <Card>
          <Badge className="text-teal-900">{ICONS.guardian} Guardian Mode</Badge>
          <h2 className="mt-4 text-2xl font-black text-slate-950">Activar Círculo Seguro</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Modo para convertir una alerta en una acción segura: mensaje discreto, guía para la persona que ayuda y pantalla neutral.</p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Input label="Contacto seguro" value={safeContact} onChange={setSafeContact} />
            <Input label="Palabra clave" value={codeWord} onChange={setCodeWord} />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["call", "Llamada de salida"],
              ["code", "Mensaje camuflado"],
              ["pickup", "Ayuda para salir"],
              ["check", "Chequeo de seguridad"]
            ].map(([key, label]) => (
              <button key={key} onClick={() => setScenario(key)} className={cx("rounded-2xl border p-3 text-left text-sm font-black shadow-sm", scenario === key ? "border-teal-300 bg-teal-50 text-teal-950" : "border-slate-200 bg-white")}>
                {scenario === key ? "✓ " : "○ "}{label}
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-teal-100 bg-teal-50/80 p-4 shadow-inner">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-teal-800">Mensaje sugerido</p>
            <p className="mt-2 text-sm leading-6 text-slate-800">{messages[scenario]}</p>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={copyMessage}>Copiar mensaje</Button>
            <Button variant="secondary" onClick={() => setNeutral(true)}>Pantalla neutral</Button>
            {copied && <span className="self-center text-sm font-black text-teal-700">Copiado.</span>}
          </div>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-slate-950 to-slate-800 text-white">
          <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-teal-400/20 blur-3xl" />
          <div className="relative">
            <Icon name="users" className="bg-white/10 text-teal-100 ring-white/10" />
            <h3 className="mt-4 text-2xl font-black">Guía para quien recibe la alerta</h3>
            <div className="mt-5 grid gap-3 text-sm leading-6 text-slate-200">
              <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10"><p className="font-black text-white">Qué hacer</p><p>Creerle, hablar con calma, preguntar qué necesita ahora, ayudarle a ubicarse en un lugar seguro y no presionar decisiones.</p></div>
              <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10"><p className="font-black text-white">Qué no hacer</p><p>No decir “yo te dije”, no pedir pruebas, no culpar, no confrontar a la pareja y no publicar la situación.</p></div>
              <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10"><p className="font-black text-white">Frase útil</p><p>“Te creo. No tienes que explicarme todo ahora. ¿Qué necesitas para estar más segura/o en este momento?”</p></div>
            </div>
          </div>
        </Card>
      </div>
    </Section>
  );
}

function EvidenceVault() {
  const [records, setRecords] = useSafeLocalStorage("amor-control-evidence-vault", []);
  const [form, setForm] = useState({ date: todayISO(), type: "Control digital", description: "", impact: "Miedo", action: "", fileNote: "" });
  const [hashing, setHashing] = useState(false);

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function addRecord() {
    if (!form.description.trim()) return;
    setHashing(true);
    const base = { ...form, id: Date.now(), createdAt: new Date().toISOString() };
    const hash = await sha256(JSON.stringify(base));
    setRecords((prev) => [{ ...base, hash }, ...prev]);
    setForm({ date: todayISO(), type: "Control digital", description: "", impact: "Miedo", action: "", fileNote: "" });
    setHashing(false);
  }

  function exportVault() {
    const lines = ["BODEGA SEGURA — " + APP_NAME, "", "Nota: preservación inicial y organización. No reemplaza cadena de custodia formal ni asesoría legal.", ""];
    records.forEach((record, index) => {
      lines.push(`#${index + 1} — ${record.date} — ${record.type}`);
      lines.push("Descripción: " + record.description);
      lines.push("Impacto: " + record.impact);
      lines.push("Acción tomada: " + (record.action || "no registrada"));
      lines.push("Archivo o referencia: " + (record.fileNote || "no registrada"));
      lines.push("Hash SHA-256 demo: " + record.hash);
      lines.push("");
    });
    downloadText("bodega_segura_amor_o_control.txt", lines.join("\n"));
  }

  return (
    <Section>
      <div className="grid gap-6 lg:grid-cols-[1fr_.95fr]">
        <Card>
          <Badge className="text-slate-600">{ICONS.vault} bodega privada</Badge>
          <h2 className="mt-4 text-2xl font-black text-slate-950">Bodega Segura / Evidence Vault</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Guarda evidencia de manera organizada para memoria personal, orientación profesional o posible denuncia. La evidencia no se sube a blockchain; solo puede generarse una huella de integridad.</p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Input label="Fecha" value={form.date} onChange={(value) => update("date", value)} type="date" />
            <Select label="Tipo de evento" value={form.type} onChange={(value) => update("type", value)} options={EVENT_TYPES} />
            <Select label="Impacto" value={form.impact} onChange={(value) => update("impact", value)} options={IMPACTS} />
            <Input label="Archivo o referencia" value={form.fileNote} onChange={(value) => update("fileNote", value)} placeholder="Ej. captura de WhatsApp, audio, enlace, testigo" />
          </div>

          <div className="mt-4">
            <TextArea label="Descripción breve del hecho" value={form.description} onChange={(value) => update("description", value)} placeholder="Describe solo lo necesario. No escribas aquí si tu dispositivo puede ser revisado." />
          </div>
          <div className="mt-4">
            <TextArea label="Acción tomada" value={form.action} onChange={(value) => update("action", value)} rowsClass="min-h-[80px]" placeholder="Ej. hablé con una amiga, guardé captura, no respondí, salí del lugar" />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={addRecord} disabled={!form.description.trim() || hashing}>{hashing ? "Generando hash..." : "Guardar registro"}</Button>
            <Button variant="secondary" onClick={exportVault} disabled={records.length === 0}>Exportar línea de tiempo</Button>
          </div>
        </Card>

        <Card>
          <h3 className="text-xl font-black text-slate-950">Línea de tiempo probatoria</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">Organiza hechos dispersos sin exponerlos en blockchain. En producción, esto debe tener cifrado fuerte, PIN, biometría y borrado seguro.</p>
          <div className="mt-5 max-h-[560px] space-y-3 overflow-auto pr-1">
            {records.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">Aún no hay registros. Cuando agregues uno, aparecerá aquí.</div>}
            {records.map((record) => (
              <div key={record.id} className="rounded-2xl border border-slate-100 bg-white/80 p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge className="text-slate-700">{record.type}</Badge>
                  <span className="text-xs font-black text-slate-400">{record.date}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-700">{record.description}</p>
                <p className="mt-2 text-xs text-slate-500">Impacto: {record.impact} · Acción: {record.action || "no registrada"}</p>
                <p className="mt-2 break-all rounded-xl bg-slate-50 p-2 text-[11px] text-slate-500">Hash demo: {record.hash}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Section>
  );
}

function ResponseSimulator() {
  const [incoming, setIncoming] = useState("¿Por qué no contestas? Mándame captura de dónde estás y con quién.");
  const [risk, setRisk] = useState("orange");
  const templates = {
    green: ["Ahora estoy ocupada/o. Te escribo luego con calma.", "Prefiero hablar cuando ambos tengamos tiempo para escucharnos bien."],
    yellow: ["No voy a responder desde presión. Podemos hablar más tarde con calma.", "Necesito espacio ahora. Te escribo después."],
    orange: ["Ahora no puedo hablar. Luego te escribo.", "No voy a enviar capturas. Podemos hablar cuando estemos tranquilos.", "Tengo que resolver algo urgente. Luego hablamos."],
    red: ["No puedo hablar ahora.", "Necesito salir de esta conversación.", "¿Me puedes llamar en cinco minutos?"]
  };

  return (
    <Section>
      <div className="grid gap-6 lg:grid-cols-[1fr_.9fr]">
        <Card>
          <Badge className="text-slate-600">{ICONS.reply} simulador de respuestas</Badge>
          <h2 className="mt-4 text-2xl font-black text-slate-950">Respuestas seguras</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Ayuda a responder sin escalar el riesgo. No se trata de ganar la discusión; se trata de conservar seguridad y claridad.</p>
          <TextArea label="Mensaje recibido" value={incoming} onChange={setIncoming} rowsClass="min-h-[140px]" />
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            {Object.entries(SEVERITY).map(([key, item]) => (
              <button key={key} onClick={() => setRisk(key)} className={cx("rounded-2xl border p-3 text-left text-sm font-black shadow-sm", risk === key ? item.tone : "border-slate-200 bg-white")}>{item.label}</button>
            ))}
          </div>
        </Card>

        <Card className={cx(SEVERITY[risk].tone, "relative overflow-hidden")}>
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/30 blur-2xl" />
          <div className="relative">
            <h3 className="text-xl font-black">Opciones de respuesta</h3>
            <p className="mt-2 text-sm leading-6">Nivel seleccionado: {SEVERITY[risk].title}</p>
            <div className="mt-5 space-y-3">
              {templates[risk].map((item) => (
                <div key={item} className="rounded-2xl border border-white/60 bg-white/80 p-4 text-sm leading-6 shadow-sm"><p>{item}</p></div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl border border-white/60 bg-white/70 p-4 text-sm leading-6">
              <p className="font-black">Regla clínica de oro</p>
              <p>Si hay riesgo rojo, no ensayes asertividad como si fuera debate universitario. Prioriza salir, pedir ayuda y reducir exposición.</p>
            </div>
          </div>
        </Card>
      </div>
    </Section>
  );
}

function EscalationMap() {
  const [events, setEvents] = useSafeLocalStorage("amor-control-escalation-map", [
    { id: 1, date: "2026-05-01", type: "Celos coercitivos", severity: "yellow" },
    { id: 2, date: "2026-05-03", type: "Control digital", severity: "orange" },
    { id: 3, date: "2026-05-05", type: "Aislamiento", severity: "orange" }
  ]);
  const [form, setForm] = useState({ date: todayISO(), type: "Control digital", severity: "orange" });
  const sorted = useMemo(() => [...events].sort((a, b) => a.date.localeCompare(b.date)), [events]);
  const highRiskCount = events.filter((event) => ["orange", "red"].includes(event.severity)).length;
  const repeatedTypes = EVENT_TYPES.filter((type) => events.filter((event) => event.type === type).length >= 2);

  function addEvent() {
    setEvents((prev) => [...prev, { ...form, id: Date.now() }]);
  }

  return (
    <Section>
      <div className="grid gap-6 lg:grid-cols-[.85fr_1.15fr]">
        <Card>
          <Badge className="text-slate-600">{ICONS.map} patrón temporal</Badge>
          <h2 className="mt-4 text-2xl font-black text-slate-950">Mapa de Escalada</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">La violencia rara vez aparece como un evento aislado. Este módulo ayuda a ver repetición, combinación y escalamiento.</p>
          <div className="mt-6 space-y-4">
            <Input label="Fecha" value={form.date} onChange={(value) => setForm((prev) => ({ ...prev, date: value }))} type="date" />
            <Select label="Tipo" value={form.type} onChange={(value) => setForm((prev) => ({ ...prev, type: value }))} options={EVENT_TYPES} />
            <Select label="Nivel" value={form.severity} onChange={(value) => setForm((prev) => ({ ...prev, severity: value }))} options={Object.entries(SEVERITY).map(([value, item]) => ({ value, label: item.label }))} />
            <Button onClick={addEvent}>Agregar evento</Button>
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <h3 className="text-xl font-black text-slate-950">Lectura del patrón</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-3xl font-black">{events.length}</p><p className="text-sm text-slate-600">eventos registrados</p></div>
              <div className="rounded-2xl bg-orange-50 p-4"><p className="text-3xl font-black">{highRiskCount}</p><p className="text-sm text-slate-600">eventos naranja/rojo</p></div>
              <div className="rounded-2xl bg-teal-50 p-4"><p className="text-3xl font-black">{repeatedTypes.length}</p><p className="text-sm text-slate-600">tipos repetidos</p></div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              {highRiskCount >= 3 ? "Hay acumulación de señales de riesgo. Conviene activar Guardian Mode, revisar plan de seguridad y hablar con una persona segura." : "Sigue observando frecuencia, intensidad e impacto. Un evento aislado no siempre define el patrón, pero tu incomodidad importa."}
            </p>
          </Card>

          <Card>
            <h3 className="text-xl font-black text-slate-950">Timeline visual</h3>
            <div className="mt-5 space-y-3">
              {sorted.map((event, index) => (
                <div key={event.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className={cx("mt-1 h-4 w-4 rounded-full ring-4 ring-white", SEVERITY[event.severity]?.dot || "bg-slate-400")} />
                    {index < sorted.length - 1 && <span className="mt-2 h-12 w-0.5 bg-slate-200" />}
                  </div>
                  <div className="flex-1 rounded-2xl border border-slate-100 bg-white/80 p-3 shadow-sm">
                    <div className="flex flex-wrap justify-between gap-2">
                      <p className="font-black text-slate-900">{event.type}</p>
                      <span className="text-xs font-black text-slate-400">{event.date}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">Nivel {SEVERITY[event.severity]?.label || "No definido"}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </Section>
  );
}

function Learn() {
  const [selected, setSelected] = useState(MODULES[0].id);
  const [quizIndex, setQuizIndex] = useState(0);
  const [answer, setAnswer] = useState(null);
  const module = MODULES.find((item) => item.id === selected) || MODULES[0];
  const quiz = QUIZ[quizIndex];
  const correct = answer === quiz.answer;

  return (
    <Section>
      <div className="grid gap-6 lg:grid-cols-[.85fr_1.15fr]">
        <Card>
          <Badge className="text-slate-600">{ICONS.book} psicoeducación</Badge>
          <h2 className="mt-4 text-2xl font-black text-slate-950">Módulos educativos</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Microaprendizaje para diferenciar amor, cuidado, conflicto, control y violencia.</p>
          <div className="mt-5 space-y-2">
            {MODULES.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelected(item.id)}
                className={cx("flex w-full items-center gap-3 rounded-2xl border p-3 text-left shadow-sm transition hover:-translate-y-0.5", selected === item.id ? "border-teal-300 bg-teal-50 text-teal-950" : "border-slate-200 bg-white/90 hover:bg-white")}
              >
                <Icon name={item.icon} className="text-teal-700" />
                <span className="font-black text-slate-900">{item.title}</span>
              </button>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="rounded-[1.4rem] border border-white/60 bg-gradient-to-br from-teal-100 via-white to-indigo-100 p-5 shadow-inner">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-slate-500 shadow-sm"><span>{ICONS[module.icon]}</span>Módulo activo</div>
              <h3 className="mt-4 text-2xl font-black text-slate-950">{module.title}</h3>
              <p className="mt-3 leading-7 text-slate-600">{module.summary}</p>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {module.bullets.map((item) => (
                <div key={item} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-slate-700 shadow-sm"><span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-teal-100 text-xs font-black text-teal-800">✓</span>{item}</div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="text-xl font-black text-slate-950">Mitos que normalizan el control</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {MYTHS.map(([myth, reality]) => (
                <div key={myth} className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm">
                  <p className="text-sm font-black text-rose-800">Mito: {myth}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Realidad: {reality}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="text-xl font-black text-slate-950">Miniquiz preventivo</h3>
            <p className="mt-2 text-sm text-slate-600">Aprender sin examen traumático, qué revolución.</p>
            <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/90 p-4 shadow-inner">
              <p className="font-black text-slate-900">{quiz.q}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {quiz.options.map((option) => (
                  <button key={option} onClick={() => setAnswer(option)} className={cx("rounded-2xl border px-4 py-2 text-sm font-black shadow-sm transition hover:-translate-y-0.5", answer === option ? (correct ? "border-emerald-300 bg-emerald-100 text-emerald-900" : "border-rose-300 bg-rose-100 text-rose-900") : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")}>{option}</button>
                ))}
              </div>
              {answer && (
                <div className="mt-4 rounded-2xl bg-white p-4 text-sm leading-6 text-slate-700 shadow-sm">
                  <p className="font-black">{correct ? "Correcto" : "Revisa esta idea"}</p>
                  <p>{quiz.feedback}</p>
                  <button
                    onClick={() => {
                      setQuizIndex((prev) => (prev + 1) % QUIZ.length);
                      setAnswer(null);
                    }}
                    className="mt-3 rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white"
                  >
                    Siguiente pregunta
                  </button>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </Section>
  );
}

function Support() {
  const [step, setStep] = useState(0);
  const [breathing, setBreathing] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!breathing) return undefined;
    const id = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [breathing]);

  const phase = seconds % 10 < 4 ? "Inhala" : "Exhala";
  const steps = [
    ["Observa", "Antes de analizar la relación, revisa tu seguridad inmediata. ¿Puedes usar esta app sin que alguien te vigile?", "eye"],
    ["Escucha", "No tienes que contar todo. Puedes elegir una frase, una emoción o saltar lo que no quieras responder.", "brain"],
    ["Conecta", "Elige una persona segura, un recurso local o un siguiente paso pequeño. Seguridad primero, discurso dramático después.", "phone"]
  ];
  const current = steps[step];

  return (
    <Section>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <Badge className="text-slate-600">{ICONS.brain} estabilización inicial</Badge>
          <h2 className="mt-4 text-2xl font-black text-slate-950">Primer apoyo psicológico digital</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Inspirado en observar, escuchar y conectar. No es terapia: es estabilización inicial y orientación segura.</p>
          <div className="mt-6 rounded-[1.5rem] border border-teal-100 bg-teal-50/90 p-5 shadow-inner">
            <Icon name={current[2]} className="text-teal-700" />
            <p className="mt-4 text-sm font-black uppercase tracking-[0.2em] text-teal-800">Paso {step + 1} de 3</p>
            <h3 className="mt-2 text-2xl font-black text-slate-950">{current[0]}</h3>
            <p className="mt-3 leading-7 text-slate-700">{current[1]}</p>
            <div className="mt-5 flex gap-3">
              <Button variant="secondary" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="border-teal-200 px-4 py-2 text-teal-900">Atrás</Button>
              <Button onClick={() => setStep(Math.min(2, step + 1))} disabled={step === 2} className="bg-teal-800 px-4 py-2 hover:bg-teal-900">Continuar</Button>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-2xl font-black text-slate-950">Respiración 4–6</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Úsala para bajar activación fisiológica. No resuelve la violencia, pero puede ayudarte a pensar con más claridad.</p>
          <div className="mt-8 grid place-items-center">
            <div className="relative">
              <div className="absolute inset-0 scale-125 rounded-full bg-teal-300/20 blur-2xl" />
              <div
                className="relative grid h-52 w-52 place-items-center rounded-full border border-white/60 bg-gradient-to-br from-teal-50 via-white to-indigo-100 shadow-[0_20px_60px_rgba(20,184,166,0.18)] transition-transform duration-1000"
                style={{ transform: breathing ? (phase === "Inhala" ? "scale(1.10)" : "scale(0.88)") : "scale(1)" }}
              >
                <div className="text-center">
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Respiración guiada</p>
                  <p className="mt-2 text-3xl font-black text-slate-950">{breathing ? phase : "Pausa"}</p>
                  <p className="mt-2 px-6 text-sm leading-5 text-slate-600">{breathing ? (phase === "Inhala" ? "Inhala lentamente por 4 segundos" : "Exhala suave por 6 segundos") : "Cuando estés lista/o, inicia."}</p>
                </div>
              </div>
            </div>
            <Button onClick={() => { setBreathing((value) => !value); setSeconds(0); }} className="mt-8">{breathing ? "Detener" : "Iniciar respiración"}</Button>
          </div>
        </Card>
      </div>
    </Section>
  );
}

function Plan() {
  const [plan, setPlan] = useSafeLocalStorage("amor-control-safety-plan", { safeContact: "", codeWord: "", safePlace: "", documents: "", digitalStep: "", nextStep: "" });
  const [saved, setSaved] = useState(false);
  const fields = [
    ["safeContact", "Contacto seguro", "Nombre o relación de una persona que pueda ayudarte sin juzgar."],
    ["codeWord", "Palabra clave", "Una frase discreta para pedir ayuda sin explicar todo."],
    ["safePlace", "Lugar seguro", "Casa, oficina, universidad o espacio donde puedas ir si necesitas salir."],
    ["documents", "Documentos o elementos importantes", "Cédula, llaves, dinero, medicinas, cargador, copias digitales seguras."],
    ["digitalStep", "Paso de seguridad digital", "Cambiar clave, revisar sesiones, activar doble factor, eliminar ubicación compartida."],
    ["nextStep", "Siguiente paso pequeño", "Algo posible en las próximas 24 horas que no aumente tu riesgo."]
  ];
  const completion = Object.values(plan).filter(Boolean).length;
  const progress = Math.round((completion / 6) * 100);

  function update(key, value) {
    setPlan((prev) => ({ ...prev, [key]: value }));
  }

  function exportPlan() {
    const content = [
      "PLAN DE SEGURIDAD — " + APP_NAME,
      "",
      "Contacto seguro: " + plan.safeContact,
      "Palabra clave: " + plan.codeWord,
      "Lugar seguro: " + plan.safePlace,
      "Documentos o elementos: " + plan.documents,
      "Seguridad digital: " + plan.digitalStep,
      "Siguiente paso: " + plan.nextStep,
      "",
      "Nota: Este plan no reemplaza ayuda profesional ni servicios de emergencia."
    ].join("\n");
    downloadText("plan_seguridad_amor_o_control.txt", content);
  }

  return (
    <Section>
      <div className="grid gap-6 lg:grid-cols-[1fr_.8fr]">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge className="text-slate-600">{ICONS.checklist} seguridad personal</Badge>
              <h2 className="mt-4 text-2xl font-black text-slate-950">Plan básico de seguridad</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Completa solo lo que sea seguro. Si tu celular puede ser revisado, no guardes datos sensibles aquí.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-2 text-sm font-black text-slate-700 shadow-sm">{completion}/6 completado</div>
          </div>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100 shadow-inner"><div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-indigo-500 transition-all duration-500" style={{ width: progress + "%" }} /></div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {fields.map(([key, label, placeholder]) => (
              <TextArea key={key} label={label} value={plan[key]} onChange={(value) => update(key, value)} placeholder={placeholder} rowsClass="min-h-[90px]" />
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={() => { setSaved(true); window.setTimeout(() => setSaved(false), 1600); }}>Guardar localmente</Button>
            <Button variant="secondary" onClick={exportPlan}>Exportar .txt</Button>
            {saved && <span className="self-center text-sm font-black text-teal-700">Guardado en este dispositivo.</span>}
          </div>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-slate-950 to-slate-800 text-white">
          <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-teal-400/20 blur-3xl" />
          <div className="relative">
            <Icon name="shield" className="bg-white/10 text-teal-100 ring-white/10" />
            <h3 className="mt-4 text-2xl font-black">Reglas de seguridad</h3>
            <div className="mt-5 space-y-3 text-sm leading-6 text-slate-200">
              <p>1. No confrontes si hay amenazas, persecución o miedo físico.</p>
              <p>2. Comparte tu plan solo con personas confiables.</p>
              <p>3. Usa la salida rápida si alguien se acerca.</p>
              <p>4. En producción, esta información debe cifrarse y nunca ir a blockchain.</p>
            </div>
            <div className="mt-6 rounded-2xl bg-white/10 p-4 text-sm leading-6 ring-1 ring-white/10">
              <p className="font-black text-white">Frase guía</p>
              <p className="mt-1 text-slate-200">No necesitas una decisión perfecta. Necesitas un siguiente paso más seguro que el anterior.</p>
            </div>
          </div>
        </Card>
      </div>
    </Section>
  );
}

function Community() {
  const [reported, setReported] = useState(null);
  const posts = [
    ["Validación", "No sabía que pedir mi ubicación todo el día era una señal de control.", "Aprendí que sentir incomodidad también es información. Estoy recuperando contacto con una amiga segura."],
    ["Aprendizaje", "Conflicto no es lo mismo que miedo.", "Una cosa es discutir; otra es quedarme en silencio porque temo su reacción."],
    ["Autonomía", "Mi límite no necesita defensa doctoral.", "Puedo decir que no, pausar una conversación y pedir espacio sin convertirlo en juicio penal sobre mi carácter."]
  ];

  return (
    <Section>
      <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
        <Card>
          <Badge className="text-slate-600">{ICONS.users} comunidad moderada</Badge>
          <h2 className="mt-4 text-2xl font-black text-slate-950">Comunidad segura</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Demo visual de un espacio anónimo, moderado e informado en trauma. En producción requiere moderación humana y protocolo de crisis.</p>
          <div className="mt-5 space-y-3">
            {["No pedir detalles íntimos ni evidencias públicas.", "No culpar, juzgar ni presionar decisiones.", "No diagnosticar parejas ni promover acoso.", "Reportar amenazas, revictimización o contenido peligroso."].map((rule) => (
              <div key={rule} className="rounded-2xl border border-slate-100 bg-slate-50/90 p-3 text-sm text-slate-700 shadow-sm">✓ {rule}</div>
            ))}
          </div>
        </Card>
        <div className="space-y-4">
          {posts.map(([tag, title, body], index) => (
            <Card key={title}>
              <div className="flex items-start justify-between gap-4">
                <Badge className="border-teal-100 bg-teal-50 text-teal-800">{tag}</Badge>
                <button onClick={() => setReported(index)} className="rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-black text-slate-500 shadow-sm transition hover:bg-white">Reportar</button>
              </div>
              <h3 className="mt-4 text-lg font-black text-slate-950">{title}</h3>
              <p className="mt-2 leading-7 text-slate-600">{body}</p>
              {reported === index && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Gracias. En producción, este reporte iría a moderación humana con protocolo de seguridad.</div>}
            </Card>
          ))}
        </div>
      </div>
    </Section>
  );
}

function Solana() {
  const [provider, setProvider] = useState(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [status, setStatus] = useState("Busca Phantom Wallet para conectar de forma real.");
  const [signature, setSignature] = useState("");
  const [signedPayload, setSignedPayload] = useState("");
  const [verificationStatus, setVerificationStatus] = useState("");
  const [txSignature, setTxSignature] = useState("");
  const [hashInput, setHashInput] = useState("Red Flag Awareness | completed scanner + guardian + safety plan");
  const [hash, setHash] = useState("");
  const [completed, setCompleted] = useState({ scanner: true, learn: false, plan: false, guardian: false });
  const allDone = Object.values(completed).every(Boolean);
  const connected = Boolean(walletAddress);

  function getPhantomProvider() {
    if (typeof window === "undefined") return null;
    const phantomProvider = window.phantom?.solana;
    if (phantomProvider?.isPhantom) return phantomProvider;
    const legacyProvider = window.solana;
    if (legacyProvider?.isPhantom) return legacyProvider;
    return null;
  }

  function shortAddress(address) {
    if (!address) return "";
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  }

  function bytesToHex(bytes) {
    return Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  function hexToBytes(hex) {
    const clean = String(hex || "").trim();

    if (!clean || clean.length % 2 !== 0 || /[^0-9a-f]/i.test(clean)) {
      throw new Error("La firma no está en formato hexadecimal válido.");
    }

    const bytes = new Uint8Array(clean.length / 2);

    for (let index = 0; index < clean.length; index += 2) {
      bytes[index / 2] = parseInt(clean.slice(index, index + 2), 16);
    }

    return bytes;
  }

  async function sha256Hex(value) {
    const encoded = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", encoded);
    return bytesToHex(new Uint8Array(digest));
  }

  useEffect(() => {
    const foundProvider = getPhantomProvider();
    setProvider(foundProvider);

    if (!foundProvider) {
      setStatus("Phantom no está instalada o no está disponible en este navegador.");
      return;
    }

    setStatus("Phantom detectada. Puedes conectar tu wallet.");

    foundProvider
      .connect({ onlyIfTrusted: true })
      .then((response) => {
        const address = response.publicKey?.toString();
        if (address) {
          setWalletAddress(address);
          setStatus("Wallet reconectada de forma segura.");
        }
      })
      .catch(() => {
        // No abrimos pop-up en conexión silenciosa. Si no estaba autorizada, esperamos al botón manual.
      });

    const handleConnect = (publicKey) => {
      const address = publicKey?.toString?.() || foundProvider.publicKey?.toString?.();
      if (address) {
        setWalletAddress(address);
        setStatus("Wallet conectada.");
      }
    };

    const handleDisconnect = () => {
      setWalletAddress("");
      setSignature("");
      setSignedPayload("");
      setVerificationStatus("");
      setTxSignature("");
      setStatus("Wallet desconectada.");
    };

    const handleAccountChanged = (publicKey) => {
      if (publicKey) {
        setWalletAddress(publicKey.toString());
        setSignature("");
        setSignedPayload("");
        setVerificationStatus("");
        setTxSignature("");
        setStatus("Cuenta cambiada en Phantom.");
      } else {
        setWalletAddress("");
        setSignature("");
        setSignedPayload("");
        setVerificationStatus("");
        setTxSignature("");
        setStatus("Cuenta desconectada desde Phantom.");
      }
    };

    foundProvider.on?.("connect", handleConnect);
    foundProvider.on?.("disconnect", handleDisconnect);
    foundProvider.on?.("accountChanged", handleAccountChanged);

    return () => {
      foundProvider.removeListener?.("connect", handleConnect);
      foundProvider.removeListener?.("disconnect", handleDisconnect);
      foundProvider.removeListener?.("accountChanged", handleAccountChanged);
    };
  }, []);

  async function connectWallet() {
    const phantomProvider = provider || getPhantomProvider();

    if (!phantomProvider) {
      setStatus("Phantom no está instalada. Abriendo descarga oficial...");
      window.open("https://phantom.app/", "_blank", "noopener,noreferrer");
      return;
    }

    try {
      const response = await phantomProvider.connect();
      const address = response.publicKey.toString();
      setProvider(phantomProvider);
      setWalletAddress(address);
      setStatus("Wallet conectada con Phantom.");
    } catch (error) {
      setStatus(error?.message || "La conexión fue cancelada o rechazada.");
    }
  }

  async function disconnectWallet() {
    try {
      await provider?.disconnect?.();
    } catch (error) {
      // Phantom puede desconectar desde la extensión; si falla, limpiamos estado local.
    } finally {
      setWalletAddress("");
      setSignature("");
      setSignedPayload("");
      setVerificationStatus("");
      setTxSignature("");
      setStatus("Wallet desconectada.");
    }
  }

  async function signProofOfCare() {
    const phantomProvider = provider || getPhantomProvider();

    if (!phantomProvider || !walletAddress) {
      setStatus("Primero conecta Phantom Wallet.");
      return;
    }

    if (!allDone) {
      setStatus("Completa scanner, módulo, plan y Guardian antes de firmar el Proof of Care.");
      return;
    }

    const message = [
      "Love or Control? | Proof of Care",
      `Wallet: ${walletAddress}`,
      `Date: ${new Date().toISOString()}`,
      "I completed the prevention flow: scanner, learning, safety plan and guardian mode.",
      "No sensitive stories, evidence, locations, risk scores or personal data are stored on-chain."
    ].join("\n");

    try {
      setSignedPayload(message);
      setVerificationStatus("");
      setTxSignature("");

      const encodedMessage = new TextEncoder().encode(message);
      const signedMessage = await phantomProvider.signMessage(encodedMessage, "utf8");
      const signatureBytes = signedMessage.signature || signedMessage;

      setSignature(bytesToHex(signatureBytes));
      setStatus("Proof of Care firmado. Esto verifica propiedad de wallet sin guardar información sensible ni pagar fees de red.");
    } catch (error) {
      setStatus(error?.message || "La firma fue cancelada o rechazada.");
    }
  }

  function verifyProofOfCareSignature() {
    if (!walletAddress || !signature || !signedPayload) {
      setVerificationStatus("Necesitas wallet, mensaje firmado y firma para verificar.");
      setStatus("Faltan datos para verificar la firma Proof of Care.");
      return;
    }

    try {
      const messageBytes = new TextEncoder().encode(signedPayload);
      const signatureBytes = hexToBytes(signature);
      const publicKeyBytes = new PublicKey(walletAddress).toBytes();

      const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

      const message = isValid
        ? "Firma verificada: esta wallet firmó este Proof of Care."
        : "Firma inválida: el mensaje, la firma o la wallet no coinciden.";

      setVerificationStatus(message);
      setStatus(message);
    } catch (error) {
      const message = error?.message || "No se pudo verificar la firma.";
      setVerificationStatus(message);
      setStatus(message);
    }
  }

  async function sendProofOfCareTransaction() {
    const phantomProvider = provider || getPhantomProvider();

    if (!phantomProvider || !walletAddress) {
      setStatus("Primero conecta Phantom Wallet.");
      return;
    }

    if (!allDone) {
      setStatus("Completa scanner, módulo, plan y Guardian antes de enviar el Proof of Care a Devnet.");
      return;
    }

    try {
      setStatus("Preparando transacción Proof of Care en Solana Devnet...");

      const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
      const proofPayload = {
        app: "Love or Control?",
        proof: "Proof of Care",
        wallet: walletAddress,
        completed: ["scanner", "learning", "safety-plan", "guardian-mode"],
        timestamp: new Date().toISOString(),
        privacy: "No sensitive data stored on-chain"
      };
      const proofHash = await sha256Hex(JSON.stringify(proofPayload));
      const memoText = `LoveOrControl ProofOfCare ${proofHash}`;
      const memoProgramId = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
      const transaction = new Transaction().add(
        new TransactionInstruction({
          keys: [],
          programId: memoProgramId,
          data: new TextEncoder().encode(memoText)
        })
      );
      const latestBlockhash = await connection.getLatestBlockhash("confirmed");

      transaction.feePayer = new PublicKey(walletAddress);
      transaction.recentBlockhash = latestBlockhash.blockhash;

      let transactionSignature = "";

      if (typeof phantomProvider.signAndSendTransaction === "function") {
        const result = await phantomProvider.signAndSendTransaction(transaction);
        transactionSignature = result?.signature || result;
      } else if (typeof phantomProvider.signTransaction === "function") {
        const signedTransaction = await phantomProvider.signTransaction(transaction);
        transactionSignature = await connection.sendRawTransaction(signedTransaction.serialize(), {
          skipPreflight: false
        });
      } else {
        throw new Error("Phantom no expone signAndSendTransaction ni signTransaction en este navegador.");
      }

      if (!transactionSignature || typeof transactionSignature !== "string") {
        throw new Error("Phantom no devolvió una firma de transacción válida.");
      }

      await connection.confirmTransaction(
        {
          signature: transactionSignature,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
        },
        "confirmed"
      );

      setHash(proofHash);
      setTxSignature(transactionSignature);
      setStatus("Proof of Care enviado a Solana Devnet. Transacción confirmada.");
    } catch (error) {
      setStatus(error?.message || "No se pudo enviar la transacción Proof of Care a Devnet.");
    }
  }

  async function generateLocalHash() {
    if (!hashInput.trim()) {
      setStatus("Escribe un texto no sensible para generar la huella SHA-256.");
      return;
    }

    const generatedHash = await sha256Hex(hashInput.trim());
    setHash(generatedHash);
    setStatus("Hash local generado. La huella puede probar integridad sin subir el contenido a blockchain.");
  }

  async function copyToClipboard(value, label) {
    try {
      await navigator.clipboard.writeText(value);
      setStatus(`${label} copiado al portapapeles.`);
    } catch (error) {
      setStatus("No se pudo copiar automáticamente. Selecciona y copia manualmente.");
    }
  }

  return (
    <Section>
      <div className="grid gap-6 lg:grid-cols-[1fr_.8fr]">
        <Card>
          <div className="flex items-center gap-3">
            <Icon name="wallet" className="text-teal-700" />
            <div>
              <h2 className="text-2xl font-black text-slate-950">Phantom Wallet + Solana</h2>
              <p className="mt-1 text-sm text-slate-600">Conexión real con Phantom para acceso pseudónimo, firma educativa y hash local de integridad.</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/90 p-4 text-sm leading-6 text-slate-700 shadow-inner">
            Esta integración usa Phantom como capa de identidad pseudónima. La wallet sirve para demostrar propiedad de una dirección, firmar un Proof of Care y, para la demo, anclar un hash no sensible en Solana Devnet mediante una transacción memo. La evidencia, historias, ubicación, contactos, capturas y niveles de riesgo no se guardan en blockchain.
          </div>

          <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/80 p-4 text-sm leading-6 text-indigo-950 shadow-inner">
            Para ver la transacción en Explorer, usa Phantom en Solana Devnet y SOL de prueba. La firma simple es off-chain; la transacción Devnet sí genera txid verificable.
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={connected ? disconnectWallet : connectWallet}>{connected ? "Desconectar Phantom" : "Conectar Phantom"}</Button>
            <Button variant="secondary" onClick={signProofOfCare} disabled={!connected || !allDone}>Firmar Proof of Care</Button>
            <Button variant="secondary" onClick={sendProofOfCareTransaction} disabled={!connected || !allDone}>Enviar Proof of Care a Devnet</Button>
          </div>

          <div className="mt-4 rounded-2xl border border-white/60 bg-white/80 p-4 text-sm shadow-sm">
            <p className="font-black text-slate-900">Estado</p>
            <p className="mt-1 text-slate-600">{status}</p>
            {connected && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge className="border-teal-100 bg-teal-50 text-teal-900">Wallet: {shortAddress(walletAddress)}</Badge>
                <Button variant="ghost" className="px-3 py-2 text-xs text-slate-700" onClick={() => copyToClipboard(walletAddress, "Dirección")}>Copiar dirección</Button>
              </div>
            )}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            {[["scanner", "Usar scanner"], ["guardian", "Activar Guardian"], ["learn", "Completar módulo"], ["plan", "Crear plan"]].map(([key, label]) => (
              <button key={key} onClick={() => setCompleted((prev) => ({ ...prev, [key]: !prev[key] }))} className={cx("rounded-2xl border p-4 text-left text-sm font-black shadow-sm transition hover:-translate-y-0.5", completed[key] ? "border-teal-300 bg-teal-50 text-teal-950" : "border-slate-200 bg-white/90 text-slate-700")}>
                <span className={completed[key] ? "text-teal-700" : "text-slate-300"}>✓</span><br />{label}
              </button>
            ))}
          </div>

          {signature && (
            <div className="mt-6 space-y-4 rounded-2xl border border-teal-200 bg-teal-50/90 p-4 text-sm text-teal-950 shadow-inner">
              <div>
                <p className="font-black">Firma generada por Phantom</p>
                <p className="mt-2 break-all font-mono text-xs leading-6">{signature}</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={() => copyToClipboard(signature, "Firma")}>Copiar firma</Button>
                  <Button variant="secondary" onClick={verifyProofOfCareSignature}>Verificar firma</Button>
                </div>
              </div>

              {signedPayload && (
                <div className="rounded-2xl border border-white/70 bg-white/80 p-4 text-sm shadow-sm">
                  <p className="font-black text-slate-900">Mensaje firmado</p>
                  <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-3 font-mono text-xs leading-6 text-teal-100">
                    {signedPayload}
                  </pre>
                  <Button variant="ghost" className="mt-3 text-slate-700" onClick={() => copyToClipboard(signedPayload, "Mensaje firmado")}>Copiar mensaje</Button>
                </div>
              )}

              {verificationStatus && (
                <div className={cx("rounded-2xl border p-3 text-sm font-bold", verificationStatus.includes("verificada") ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900")}>
                  {verificationStatus}
                </div>
              )}
            </div>
          )}

          {txSignature && (
            <div className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50/90 p-4 text-sm text-indigo-950 shadow-inner">
              <p className="font-black">Transacción Proof of Care en Solana Devnet</p>
              <p className="mt-2 break-all font-mono text-xs leading-6">{txSignature}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <a
                  href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-2xl bg-slate-950 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:-translate-y-0.5"
                >
                  Ver en Solana Explorer
                </a>
                <Button variant="secondary" onClick={() => copyToClipboard(txSignature, "Firma de transacción")}>Copiar txid</Button>
              </div>
            </div>
          )}
        </Card>

        <Card className={cx("relative overflow-hidden", allDone && connected ? "border-teal-200 bg-teal-50/90" : "")}> 
          <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-teal-300/20 blur-3xl" />
          <div className="relative">
            <Icon name="spark" className="text-teal-700" />
            <h3 className="mt-4 text-2xl font-black text-slate-950">Badge: Red Flag Awareness</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">Reconocimiento simbólico por completar aprendizaje preventivo. Recomendación ética: mantenerlo no transferible o de bajo incentivo para no gamificar experiencias de violencia.</p>
            <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-white/80 p-5 text-center shadow-sm">
              <div className="mx-auto grid h-28 w-28 place-items-center rounded-full border border-teal-200 bg-gradient-to-br from-teal-100 to-indigo-100 text-4xl shadow-inner">🛡️</div>
              <p className="mt-4 text-sm font-black uppercase tracking-[0.2em] text-slate-500">Estado</p>
              <p className="mt-1 text-xl font-black text-slate-950">{connected && allDone ? "Listo para Proof of Care" : "Pendiente"}</p>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
              <TextArea
                label="Texto NO sensible para generar hash local"
                value={hashInput}
                onChange={setHashInput}
                rowsClass="min-h-[90px]"
              />
              <div className="mt-3 flex flex-wrap gap-3">
                <Button variant="secondary" onClick={generateLocalHash}>Generar hash SHA-256</Button>
                {hash && <Button variant="ghost" className="text-slate-700" onClick={() => copyToClipboard(hash, "Hash")}>Copiar hash</Button>}
              </div>
              {hash && <p className="mt-3 break-all rounded-2xl bg-slate-950 p-3 font-mono text-xs leading-6 text-teal-100">{hash}</p>}
            </div>
          </div>
        </Card>
      </div>
    </Section>
  );
}


export default function AmorOControlApp() {
  const [active, setActive] = useState("home");
  const panels = {
    home: <Home setActive={setActive} />,
    scanner: <Scanner setActive={setActive} />,
    guardian: <GuardianMode />,
    vault: <EvidenceVault />,
    reply: <ResponseSimulator />,
    map: <EscalationMap />,
    learn: <Learn />,
    support: <Support />,
    plan: <Plan />,
    community: <Community />,
    solana: <Solana />
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-950 text-slate-900">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="absolute right-0 top-40 h-96 w-96 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-fuchsia-400/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.05),transparent_25%,transparent_75%,rgba(255,255,255,0.03))]" />
      </div>
      <QuickExit />
      <Header active={active} setActive={setActive} />
      {panels[active]}
      <footer className="relative z-10 mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
        <div className="rounded-[1.75rem] border border-white/10 bg-white/80 p-5 text-sm leading-6 text-slate-600 shadow-[0_20px_60px_rgba(0,0,0,0.15)] backdrop-blur-xl">
          <p className="font-black text-slate-900">Aviso ético</p>
          <p className="mt-1">Esta demo es una herramienta psicoeducativa de orientación inicial. No reemplaza terapia, asesoría legal, cadena de custodia formal ni servicios de emergencia. Si existe peligro inmediato, contacta servicios de emergencia o redes de protección de tu localidad.</p>
        </div>
      </footer>
    </div>
  );
}
