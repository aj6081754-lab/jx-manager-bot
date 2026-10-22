
const supabase = require("./supabase");

async function testConnection() {
  console.log("Probando conexión con Supabase...");

  const { data, error } = await supabase
    .from("guild_settings")
    .select("guild_id")
    .limit(1);

  if (error) {
    console.error("La consulta falló:", error.message);
    process.exitCode = 1;
    return;
  }

  console.log("Conexión correcta.");
  console.log("La consulta se completó sin modificar datos.");
  console.log("Filas encontradas:", data.length);
}

testConnection().catch((error) => {
  console.error("Error inesperado:", error.message);
  process.exitCode = 1;
});
