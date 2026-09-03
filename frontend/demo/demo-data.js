export const DEMO_DATA = Object.freeze({
  meta: {
    demo: true,
    label: 'DEMO – ausschließlich Beispieldaten',
    referenceDate: '2026-09-03',
    version: 'showcase-1'
  },
  company: {
    id: 'company-musterwerk',
    name: 'Musterwerk Solutions GmbH',
    industry: 'Produktion & Logistik',
    location: 'Nordrhein-Westfalen',
    employeesLabel: '15 Mitarbeitende'
  },
  employees: [
    { id:'emp-lena-hoffmann', name:'Lena Hoffmann', email:'lena.hoffmann@musterwerk.example', department:'Produktion', jobTitle:'Produktionsleitung', role:'company_admin', active:true },
    { id:'emp-jonas-keller', name:'Jonas Keller', email:'jonas.keller@musterwerk.example', department:'Produktion', jobTitle:'Schichtleitung Produktion', role:'line_manager', lineManagerId:'emp-lena-hoffmann', active:true },
    { id:'emp-mila-hartmann', name:'Mila Hartmann', email:'mila.hartmann@musterwerk.example', department:'Produktion', jobTitle:'Produktionsmitarbeiterin', role:'employee', lineManagerId:'emp-jonas-keller', active:true },
    { id:'emp-david-sommer', name:'David Sommer', email:'david.sommer@musterwerk.example', department:'Produktion', jobTitle:'Produktionsmitarbeiter', role:'employee', lineManagerId:'emp-jonas-keller', active:true },
    { id:'emp-amira-koenig', name:'Amira König', email:'amira.koenig@musterwerk.example', department:'Produktion', jobTitle:'Produktionsmitarbeiterin', role:'employee', lineManagerId:'emp-jonas-keller', active:true },
    { id:'emp-felix-berger', name:'Felix Berger', email:'felix.berger@musterwerk.example', department:'Lager & Logistik', jobTitle:'Lagerleitung', role:'line_manager', lineManagerId:'emp-lena-hoffmann', active:true },
    { id:'emp-nora-weiss', name:'Nora Weiss', email:'nora.weiss@musterwerk.example', department:'Lager & Logistik', jobTitle:'Fachkraft Lagerlogistik', role:'employee', lineManagerId:'emp-felix-berger', active:true },
    { id:'emp-leon-wagner', name:'Leon Wagner', email:'leon.wagner@musterwerk.example', department:'Lager & Logistik', jobTitle:'Fachlagerist', role:'employee', lineManagerId:'emp-felix-berger', active:true },
    { id:'emp-elias-braun', name:'Elias Braun', email:'elias.braun@musterwerk.example', department:'Lager & Logistik', jobTitle:'Kommissionierer', role:'employee', lineManagerId:'emp-felix-berger', active:true },
    { id:'emp-sophie-neumann', name:'Sophie Neumann', email:'sophie.neumann@musterwerk.example', department:'Verwaltung', jobTitle:'Sachbearbeitung', role:'employee', lineManagerId:'emp-lena-hoffmann', active:true },
    { id:'emp-marie-vogel', name:'Marie Vogel', email:'marie.vogel@musterwerk.example', department:'Verwaltung', jobTitle:'Personalreferentin', role:'employee', lineManagerId:'emp-lena-hoffmann', active:true },
    { id:'emp-luca-richter', name:'Luca Richter', email:'luca.richter@musterwerk.example', department:'Technik', jobTitle:'Technischer Leiter', role:'line_manager', lineManagerId:'emp-lena-hoffmann', active:true },
    { id:'emp-emma-krueger', name:'Emma Krüger', email:'emma.krueger@musterwerk.example', department:'Technik', jobTitle:'Mechatronikerin', role:'employee', lineManagerId:'emp-luca-richter', active:true },
    { id:'emp-noah-schmitt', name:'Noah Schmitt', email:'noah.schmitt@musterwerk.example', department:'Lager & Logistik', jobTitle:'Auszubildender', role:'employee', lineManagerId:'emp-felix-berger', active:true },
    { id:'emp-mia-franke', name:'Mia Franke', email:'mia.franke@musterwerk.example', department:'Qualitätsmanagement', jobTitle:'Qualitätsmanagerin', role:'employee', lineManagerId:'emp-lena-hoffmann', active:true }
  ],
  instructionTypes: [
    { id:'ins-arbeitsschutz', name:'Allgemeine Arbeitsschutzunterweisung', category:'Arbeitsschutz', deliveryMode:'online', testRequired:true, passPercent:80, intervalMonths:12, active:true, description:'Grundregeln für sicheres Arbeiten, Meldewege und Verhalten bei Gefährdungen.' },
    { id:'ins-brandschutz', name:'Brandschutz & Evakuierung', category:'Arbeitsschutz', deliveryMode:'online', testRequired:true, passPercent:80, intervalMonths:12, active:true, description:'Alarmierung, Fluchtwege, Sammelplatz und richtiges Verhalten im Brandfall.' },
    { id:'ins-psa', name:'Persönliche Schutzausrüstung (PSA)', category:'Arbeitsschutz', deliveryMode:'online', testRequired:true, passPercent:80, intervalMonths:12, active:true, description:'Auswahl, Nutzung und Kontrolle persönlicher Schutzausrüstung.' },
    { id:'ins-gefahrstoffe', name:'Gefahrstoff-Unterweisung', category:'Gefahrstoffe', deliveryMode:'online', testRequired:true, passPercent:80, intervalMonths:12, active:true, description:'Kennzeichnung, Lagerung und sicheres Verhalten bei Gefahrstoffen.' },
    { id:'ins-stapler', name:'Flurförderzeuge / Stapler', category:'Lager & Logistik', deliveryMode:'practical', testRequired:false, passPercent:0, intervalMonths:12, active:true, description:'Praktische Unterweisung zu Kontrolle, Fahrwegen und sicherem Betrieb.' },
    { id:'ins-ladungssicherung', name:'Ladungssicherung', category:'Lager & Logistik', deliveryMode:'practical', testRequired:false, passPercent:0, intervalMonths:12, active:true, description:'Praktische Sicherung von Ladeeinheiten und Kontrolle vor Abfahrt.' },
    { id:'ins-datenschutz', name:'Datenschutz im Arbeitsalltag', category:'Compliance', deliveryMode:'online', testRequired:true, passPercent:80, intervalMonths:24, active:true, description:'Sicherer Umgang mit personenbezogenen Daten im Tagesgeschäft.' },
    { id:'ins-phishing', name:'Informationssicherheit & Phishing', category:'IT-Sicherheit', deliveryMode:'online', testRequired:true, passPercent:80, intervalMonths:12, active:true, description:'Phishing erkennen, Links prüfen und Sicherheitsvorfälle richtig melden.' },
    { id:'ins-ergonomie', name:'Bildschirmarbeitsplatz / Ergonomie', category:'Gesundheit', deliveryMode:'online', testRequired:false, passPercent:0, intervalMonths:24, active:true, description:'Arbeitsplatz einstellen, Pausen sinnvoll nutzen und Belastungen reduzieren.' },
    { id:'ins-unfall', name:'Verhalten bei Arbeitsunfällen', category:'Arbeitsschutz', deliveryMode:'online', testRequired:true, passPercent:80, intervalMonths:12, active:true, description:'Erste Schritte, Ersthelfer, Meldung und Dokumentation bei Arbeitsunfällen.' }
  ],
  assignments: [
    { id:'asg-01', employeeId:'emp-mila-hartmann', instructionId:'ins-arbeitsschutz', status:'in_progress', dueDate:'2026-09-07', progress:1 },
    { id:'asg-02', employeeId:'emp-mila-hartmann', instructionId:'ins-brandschutz', status:'missing', dueDate:'2026-09-12', progress:0 },
    { id:'asg-03', employeeId:'emp-mila-hartmann', instructionId:'ins-psa', status:'soon', dueDate:'2026-09-20', progress:0 },
    { id:'asg-04', employeeId:'emp-mila-hartmann', instructionId:'ins-ladungssicherung', status:'planned', dueDate:'2026-09-10', progress:0 },
    { id:'asg-05', employeeId:'emp-mila-hartmann', instructionId:'ins-phishing', status:'valid', dueDate:'2027-05-10', progress:0 },
    { id:'asg-06', employeeId:'emp-david-sommer', instructionId:'ins-arbeitsschutz', status:'expired', dueDate:'2026-08-21', progress:0 },
    { id:'asg-07', employeeId:'emp-david-sommer', instructionId:'ins-brandschutz', status:'critical', dueDate:'2026-09-05', progress:0 },
    { id:'asg-08', employeeId:'emp-amira-koenig', instructionId:'ins-arbeitsschutz', status:'valid', dueDate:'2027-03-16', progress:0 },
    { id:'asg-09', employeeId:'emp-nora-weiss', instructionId:'ins-stapler', status:'practical_pending', dueDate:'2026-09-08', progress:0 },
    { id:'asg-10', employeeId:'emp-nora-weiss', instructionId:'ins-ladungssicherung', status:'valid', dueDate:'2027-01-12', progress:0 },
    { id:'asg-11', employeeId:'emp-leon-wagner', instructionId:'ins-stapler', status:'planned', dueDate:'2026-09-09', progress:0 },
    { id:'asg-12', employeeId:'emp-elias-braun', instructionId:'ins-arbeitsschutz', status:'missing', dueDate:'2026-09-06', progress:0 },
    { id:'asg-13', employeeId:'emp-noah-schmitt', instructionId:'ins-brandschutz', status:'in_progress', dueDate:'2026-09-15', progress:2 },
    { id:'asg-14', employeeId:'emp-sophie-neumann', instructionId:'ins-datenschutz', status:'soon', dueDate:'2026-09-28', progress:0 },
    { id:'asg-15', employeeId:'emp-marie-vogel', instructionId:'ins-phishing', status:'critical', dueDate:'2026-09-04', progress:0 },
    { id:'asg-16', employeeId:'emp-emma-krueger', instructionId:'ins-arbeitsschutz', status:'valid', dueDate:'2027-04-01', progress:0 },
    { id:'asg-17', employeeId:'emp-emma-krueger', instructionId:'ins-gefahrstoffe', status:'soon', dueDate:'2026-09-25', progress:0 },
    { id:'asg-18', employeeId:'emp-mia-franke', instructionId:'ins-phishing', status:'valid', dueDate:'2027-02-10', progress:0 },
    { id:'asg-19', employeeId:'emp-mia-franke', instructionId:'ins-unfall', status:'not_required', dueDate:null, progress:0 },
    { id:'asg-20', employeeId:'emp-luca-richter', instructionId:'ins-gefahrstoffe', status:'expired', dueDate:'2026-08-30', progress:0 }
  ],
  plannedTrainings: [
    { id:'plan-01', employeeId:'emp-mila-hartmann', instructionId:'ins-ladungssicherung', date:'2026-09-10T10:00:00', responsibleId:'emp-jonas-keller', status:'planned' },
    { id:'plan-02', employeeId:'emp-leon-wagner', instructionId:'ins-stapler', date:'2026-09-09T08:30:00', responsibleId:'emp-felix-berger', status:'planned' }
  ],
  records: [
    { id:'rec-01', employeeId:'emp-mila-hartmann', instructionId:'ins-phishing', completedAt:'2026-05-10', source:'demo-online', score:100 },
    { id:'rec-02', employeeId:'emp-nora-weiss', instructionId:'ins-ladungssicherung', completedAt:'2026-01-12', source:'demo-practical', confirmedBy:'emp-felix-berger' },
    { id:'rec-03', employeeId:'emp-amira-koenig', instructionId:'ins-arbeitsschutz', completedAt:'2026-03-16', source:'demo-online', score:90 },
    { id:'rec-04', employeeId:'emp-emma-krueger', instructionId:'ins-arbeitsschutz', completedAt:'2026-04-01', source:'demo-online', score:100 },
    { id:'rec-05', employeeId:'emp-mia-franke', instructionId:'ins-phishing', completedAt:'2026-02-10', source:'demo-online', score:90 }
  ],
  learningSteps: [
    { id:'step-as-1', instructionId:'ins-arbeitsschutz', order:1, title:'Gefahren erkennen', text:'Prüfe deinen Arbeitsbereich vor Beginn auf Stolperstellen, beschädigte Hilfsmittel und andere erkennbare Gefahren.', image:'./assets/work-safety.svg' },
    { id:'step-as-2', instructionId:'ins-arbeitsschutz', order:2, title:'Sicher handeln', text:'Nutze vorgeschriebene Schutzmaßnahmen und stoppe Tätigkeiten, wenn eine akute Gefahr nicht beherrscht ist.', image:'./assets/work-safety.svg' },
    { id:'step-as-3', instructionId:'ins-arbeitsschutz', order:3, title:'Gefährdungen melden', text:'Melde unsichere Zustände direkt an die zuständige Führungskraft und dokumentiere relevante Beobachtungen.', image:'./assets/work-safety.svg' },
    { id:'step-bs-1', instructionId:'ins-brandschutz', order:1, title:'Alarm wahrnehmen', text:'Beende die Tätigkeit, sichere den Bereich nur soweit gefahrlos möglich und folge der Alarmierung.', image:'./assets/fire-safety.svg' },
    { id:'step-bs-2', instructionId:'ins-brandschutz', order:2, title:'Fluchtweg nutzen', text:'Nutze gekennzeichnete Fluchtwege, keine Aufzüge und unterstütze Personen nur ohne Eigengefährdung.', image:'./assets/fire-safety.svg' },
    { id:'step-bs-3', instructionId:'ins-brandschutz', order:3, title:'Sammelplatz', text:'Gehe direkt zum vorgesehenen Sammelplatz und warte auf weitere Anweisungen.', image:'./assets/fire-safety.svg' },
    { id:'step-ph-1', instructionId:'ins-phishing', order:1, title:'Absender prüfen', text:'Achte auf ungewöhnliche Absender, unerwartete Dringlichkeit und abweichende Schreibweisen.', image:'./assets/phishing.svg' },
    { id:'step-ph-2', instructionId:'ins-phishing', order:2, title:'Linkziel kontrollieren', text:'Öffne verdächtige Links nicht. Prüfe Zieladressen und nutze bekannte Portale direkt.', image:'./assets/phishing.svg' },
    { id:'step-ph-3', instructionId:'ins-phishing', order:3, title:'Vorfall melden', text:'Melde verdächtige Nachrichten über den vorgesehenen internen Meldeweg und lösche sie nicht voreilig.', image:'./assets/phishing.svg' },
    { id:'step-psa-1', instructionId:'ins-psa', order:1, title:'Passende PSA auswählen', text:'Nutze nur die für Tätigkeit und Gefährdung vorgesehene persönliche Schutzausrüstung.', image:'./assets/work-safety.svg' },
    { id:'step-psa-2', instructionId:'ins-psa', order:2, title:'Vor Gebrauch prüfen', text:'Kontrolliere die Schutzausrüstung auf sichtbare Schäden und korrekten Sitz.', image:'./assets/work-safety.svg' },
    { id:'step-psa-3', instructionId:'ins-psa', order:3, title:'Mängel melden', text:'Beschädigte oder ungeeignete PSA darf nicht weiterverwendet werden und muss ersetzt werden.', image:'./assets/work-safety.svg' },
    { id:'step-gs-1', instructionId:'ins-gefahrstoffe', order:1, title:'Kennzeichnung lesen', text:'Beachte Gefahrensymbole und die für den Arbeitsplatz bereitgestellten Informationen.', image:'./assets/work-safety.svg' },
    { id:'step-gs-2', instructionId:'ins-gefahrstoffe', order:2, title:'Sicher lagern', text:'Lagere Stoffe nur in freigegebenen Bereichen und halte Behälter geschlossen.', image:'./assets/warehouse.svg' },
    { id:'step-gs-3', instructionId:'ins-gefahrstoffe', order:3, title:'Bei Austritt reagieren', text:'Bereich sichern, Abstand halten und den festgelegten Meldeweg nutzen.', image:'./assets/work-safety.svg' },
    { id:'step-ds-1', instructionId:'ins-datenschutz', order:1, title:'Daten minimieren', text:'Verarbeite nur Daten, die du für deine Aufgabe tatsächlich benötigst.', image:'./assets/phishing.svg' },
    { id:'step-ergo-1', instructionId:'ins-ergonomie', order:1, title:'Arbeitsplatz einstellen', text:'Richte Sitzhöhe, Bildschirm und Eingabegeräte so ein, dass eine entspannte Haltung möglich ist.', image:'./assets/work-safety.svg' },
    { id:'step-unfall-1', instructionId:'ins-unfall', order:1, title:'Situation sichern', text:'Achte zuerst auf Eigenschutz, sichere die Unfallstelle und alarmiere Hilfe.', image:'./assets/work-safety.svg' }
  ],
  tests: [
    { instructionId:'ins-arbeitsschutz', questions:[
      { id:'q-as-1', text:'Was ist bei einer erkennbaren akuten Gefahr richtig?', options:['Tätigkeit fortsetzen','Tätigkeit stoppen und melden','Erst am Monatsende melden'], correctOption:1 },
      { id:'q-as-2', text:'Wann wird der Arbeitsbereich auf erkennbare Gefahren geprüft?', options:['Vor Arbeitsbeginn','Nur nach einem Unfall','Nur durch externe Prüfer'], correctOption:0 }
    ]},
    { instructionId:'ins-brandschutz', questions:[
      { id:'q-bs-1', text:'Was ist im Brandfall der richtige Weg?', options:['Zum Sammelplatz über gekennzeichnete Fluchtwege','Aufzug nutzen','Zurück zum Arbeitsplatz'], correctOption:0 },
      { id:'q-bs-2', text:'Wo wartest du nach der Evakuierung?', options:['Im Auto','Am vorgesehenen Sammelplatz','Vor dem Gebäudezugang'], correctOption:1 }
    ]},
    { instructionId:'ins-psa', questions:[
      { id:'q-psa-1', text:'Was passiert mit beschädigter PSA?', options:['Weiterverwenden','Selbst reparieren ohne Freigabe','Nicht weiterverwenden und Ersatz veranlassen'], correctOption:2 }
    ]},
    { instructionId:'ins-gefahrstoffe', questions:[
      { id:'q-gs-1', text:'Wo werden Gefahrstoffe gelagert?', options:['In freigegebenen Bereichen','Beliebig am Arbeitsplatz','Im Pausenraum'], correctOption:0 }
    ]},
    { instructionId:'ins-datenschutz', questions:[
      { id:'q-ds-1', text:'Welche Daten sollen verarbeitet werden?', options:['Alle verfügbaren','Nur die für die Aufgabe benötigten','Nur private Daten'], correctOption:1 }
    ]},
    { instructionId:'ins-phishing', questions:[
      { id:'q-ph-1', text:'Was tust du bei einem verdächtigen Link?', options:['Sofort öffnen','Link nicht öffnen und Ziel prüfen','An Kolleginnen weiterleiten'], correctOption:1 },
      { id:'q-ph-2', text:'Was ist bei ungewöhnlicher Dringlichkeit sinnvoll?', options:['Absender und Kontext prüfen','Sofort Zugangsdaten eingeben','Warnhinweise ignorieren'], correctOption:0 }
    ]},
    { instructionId:'ins-unfall', questions:[
      { id:'q-u-1', text:'Was steht bei einem Unfall zuerst im Vordergrund?', options:['Eigenschutz und Hilfe alarmieren','Fotos machen','Arbeit fortsetzen'], correctOption:0 }
    ]}
  ]
});
