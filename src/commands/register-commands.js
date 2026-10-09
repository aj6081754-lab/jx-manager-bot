const {
  REST,
  Routes,
  SlashCommandBuilder,
} = require("discord.js");

// =====================================================
// COMANDOS
// =====================================================

const commands = [

  new SlashCommandBuilder()
    .setName("anuncio")
    .setDescription(
      "Envía el anuncio configurado a todos los servidores"
    ),

].map(command => command.toJSON());


// =====================================================
// DISCORD REST
// =====================================================

const rest = new REST({
  version: "10",
}).setToken(
  process.env.DISCORD_TOKEN
);


// =====================================================
// REGISTRAR COMANDOS
// =====================================================

async function registerCommands() {

  try {

    console.log(
      "🔄 Registrando comandos..."
    );

    await rest.put(
      Routes.applicationCommands(
        process.env.CLIENT_ID
      ),
      {
        body: commands,
      }
    );

    console.log(
      "✅ Comando /anuncio registrado correctamente."
    );

  } catch (error) {

    console.error(
      "❌ Error registrando comandos:",
      error
    );

  }

}


registerCommands();