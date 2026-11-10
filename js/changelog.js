/* VetroReport — histórico de atualizações (mais recente primeiro).
   Acrescentar uma entrada no TOPO em cada nova versão (a mesma de APP_VERSION em config.js). */
VR.CHANGELOG = [
  { versao: "3.1", data: "2026-11-10", titulo: "Versão, histórico e autoria", alteracoes: [
    "Número da versão visível no ecrã de entrada e em Mais.",
    "Aviso «Nova versão disponível — atualizar» quando sai uma atualização da aplicação.",
    "Nova página «Histórico de atualizações» em Mais.",
    "Cada registo, ocorrência, nota, funcionário, obra e equipa guarda quem criou e quem alterou, e quando. Estes dados são preenchidos pela base de dados e não podem ser alterados a partir da aplicação.",
    "Na ficha do dia aparece «Criado por … em … · Alterado por … em …» (formato 24h).",
    "Exportações CSV e Excel incluem quem registou; o Excel tem uma nova folha «Registos diários» com o autor de cada dia.",
    "A importação da versão 2.3 mantém o autor original ou marca «importado».",
    "Corrigido: o ficheiro Excel exportado podia ser dado como danificado por alguns programas.",
  ]},
  { versao: "3.0", data: "2026-11-09", titulo: "Aplicação Android e PC com base de dados na nuvem", alteracoes: [
    "Aplicação instalável (PWA): Android (Chrome, «Adicionar ao ecrã principal») e PC (Edge/Chrome, «Instalar»).",
    "Dados numa base de dados partilhada na nuvem (Supabase, servidores na UE), em vez do ficheiro no OneDrive.",
    "As alterações dos outros utilizadores aparecem em tempo real; acabou o modo de leitura.",
    "Aviso quando duas pessoas alteram o mesmo registo ao mesmo tempo.",
    "Fotografias das ocorrências num arquivo privado.",
    "Importação dos dados da versão 2.3 (só administração).",
    "Sem rede, abre com os últimos dados (só consulta).",
  ]},
  { versao: "2.3", data: "2026-11-06", titulo: "Obra opcional", alteracoes: [
    "A obra passa a ser opcional no registo do dia: pode gravar «Presente» só com entrada e saída.",
    "Em Hoje, quem não tem obra aparece em «Sem obra indicada».",
  ]},
  { versao: "2.2", data: "2026-11-06", titulo: "Horas em 24h", alteracoes: [
    "Horas sempre em formato 24h (ex.: 08:00, 17:30), sem AM/PM.",
  ]},
  { versao: "2.1", data: "2026-11-06", titulo: "Atalho e ícone na barra de tarefas", alteracoes: [
    "Atalho no ambiente de trabalho com o ícone VetroReport (conceito C), que pode ser afixado na barra de tarefas.",
    "Abre em janela própria do Edge ou Chrome, sem a barra do navegador.",
  ]},
  { versao: "2.0", data: "2026-11-06", titulo: "Aplicação HTML com dados no OneDrive", alteracoes: [
    "Aplicação HTML que abre no Edge ou Chrome com duplo clique, sem instalar nada.",
    "Dados num ficheiro partilhado no OneDrive (vetroreport.json), com cópias diárias.",
    "Importação dos dados do VetroReport 1.x; as palavras-passe antigas continuam a funcionar.",
    "Novo ecrã de Equipas.",
  ]},
  { versao: "1.x", data: null, titulo: "Programa para Windows (VetroReport.exe)", alteracoes: [
    "Primeira versão para Windows: registo diário das equipas, faltas, ocorrências e exportação para salários.",
    "Correção dos fusos horários (tzdata) que impedia o programa de arrancar nalguns computadores.",
    "Horas de entrada e saída em destaque.",
    "«Trabalho realizado» passa a ser opcional.",
    "Ícone VetroReport (conceito C).",
  ]},
];
