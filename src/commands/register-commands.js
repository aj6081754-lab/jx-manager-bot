const {
  REST,
  Routes,
  SlashCommandBuilder,
} = require("discord.js");

// =====================================================
// COMANDOS
// =====================================================

const commands = [

  // ===================================================
  // CONFIG
  // ===================================================

  new SlashCommandBuilder()
    .setName("config")
    .setDescription(
      "Configura el sistema de Staff"
    ),

  // ===================================================
  // HELP
  // ===================================================

  new SlashCommandBuilder()
    .setName("help")
    .setDescription(
      "Muestra la guía de uso del bot"
    ),

  // ===================================================
  // LISTA STAFF
  // ===================================================

  new SlashCommandBuilder()
    .setName("lista-staff")
    .setDescription(
      "Muestra todos los miembros del equipo Staff"
    ),

  // ===================================================
  // LISTA ADMINS
  // ===================================================

  new SlashCommandBuilder()
    .setName("lista-admins")
    .setDescription(
      "Muestra todos los miembros del equipo Admin"
    ),

  // ===================================================
  // RANKING GENERAL
  // ===================================================

  new SlashCommandBuilder()
    .setName("ranking")
    .setDescription(
      "Muestra el ranking semanal del Staff"
    ),

  // ===================================================
  // PROGRESO INDIVIDUAL
  // ===================================================

  new SlashCommandBuilder()
    .setName("progreso")
    .setDescription(
      "Muestra el progreso de un miembro del Staff"
    )
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription(
          "Staff cuyo progreso quieres consultar"
        )
        .setRequired(false)
    ),

  // ===================================================
  // PROGRESO DIARIO
  // ===================================================

  new SlashCommandBuilder()
    .setName("progreso-diario")
    .setDescription(
      "Muestra el progreso diario de todo el Staff"
    ),

  // ===================================================
  // REPORTE DIARIO DE PRUEBA
  // ===================================================

  new SlashCommandBuilder()
    .setName("reporte-diario-test")
    .setDescription(
      "Envía inmediatamente un reporte diario de prueba"
    ),

  // ===================================================
  // PROGRESO SEMANAL
  // ===================================================

  new SlashCommandBuilder()
    .setName("progreso-semanal")
    .setDescription(
      "Muestra el progreso semanal de todo el Staff"
    ),

  // ===================================================
  // HISTORIAL SEMANAL
  // ===================================================

  new SlashCommandBuilder()
    .setName("historial")
    .setDescription(
      "Consulta un reporte semanal guardado"
    )
    .addStringOption(option =>
      option
        .setName("codigo")
        .setDescription(
          "Código del historial, por ejemplo WK-ABC123"
        )
        .setRequired(true)
    ),

  // ===================================================
  // TOP ALIANZAS
  // ===================================================

  new SlashCommandBuilder()
    .setName("top-alianzas")
    .setDescription(
      "Muestra el ranking de alianzas del Staff"
    ),

  // ===================================================
  // TOP AFILIACIONES
  // ===================================================

  new SlashCommandBuilder()
    .setName("top-afiliaciones")
    .setDescription(
      "Muestra el ranking de afiliaciones del Staff"
    ),

  // ===================================================
  // TOP MENSAJES
  // ===================================================

  new SlashCommandBuilder()
    .setName("top-mensajes")
    .setDescription(
      "Muestra el ranking de mensajes del Staff"
    ),

  // ===================================================
  // P-M-D
  // ===================================================

  new SlashCommandBuilder()
    .setName("p-m-d")
    .setDescription(
      "Muestra quién sube, mantiene o baja según su progreso semanal"
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
      "✅ Comandos registrados correctamente."
    );

  } catch (error) {

    console.error(
      "❌ Error registrando comandos:",
      error
    );

  }

}


registerCommands();