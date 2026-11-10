/* VetroReport — configuração e VERSÃO da aplicação (fonte única).
   Em cada atualização: subir APP_VERSION aqui e acrescentar a entrada em js/changelog.js.
   O service worker (sw.js) lê este ficheiro, por isso mudar a versão faz os telemóveis
   descarregarem a atualização e mostrarem «Nova versão disponível — atualizar».

   Ligação à base de dados VetroReport (Supabase, projeto vetroreport, UE/Paris).
   A chave "publishable" é pública por natureza: o acesso aos dados é protegido
   por login e pelas regras RLS na base de dados. */
self.APP_VERSION = "3.1";
self.VR_CONFIG = {
  SUPABASE_URL: "https://yciyhtlzslumyrhgqowl.supabase.co",
  SUPABASE_KEY: "sb_publishable_OacHk3nqe-SCyFpwjW9JUQ_LfSW8dKh",
};
