
const supabase = require("./supabase");
const {
  getGuildSettings,
  updateGuildSettings,
} = require("./guild-settings");

async function main() {
  const testGuildId = `jx-manager-test-${Date.now()}`;

  try {
    console.log("1. Probando lectura y creación de configuración...");

    const initial = await getGuildSettings(testGuildId);

    console.log("Configuración inicial:", {
      language: initial.language,
      prefix: initial.prefix,
    });

    console.log("\n2. Probando escritura...");

    const updated = await updateGuildSettings(testGuildId, {
      language: "en",
      prefix: "T!",
    });

    if (updated.language !== "en" || updated.prefix !== "T!") {
      throw new Error("Los valores guardados no coinciden.");
    }

    console.log("Configuración actualizada correctamente.");

    console.log("\n3. Verificando lectura final...");

    const saved = await getGuildSettings(testGuildId);

    console.log("Configuración recuperada:", {
      language: saved.language,
      prefix: saved.prefix,
    });

    console.log("\nPRUEBA COMPLETADA CORRECTAMENTE.");
  } catch (error) {
    console.error("\nLA PRUEBA FALLÓ:");
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    console.log("\nEliminando configuración temporal...");

    const { error } = await supabase
      .from("guild_settings")
      .delete()
      .eq("guild_id", testGuildId);

    if (error) {
      console.error(
        "No se pudo eliminar la fila temporal:",
        error.message
      );
      process.exitCode = 1;
    } else {
      console.log("Limpieza completada.");
    }
  }
}

main();
