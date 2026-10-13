const {
  Client,
  GatewayIntentBits,
  Events,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  MessageFlags
} = require("discord.js");

// ============================================
// CONFIGURACIÓN SEGURA
// ============================================

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error(
    "Faltan los Secrets DISCORD_TOKEN o CLIENT_ID en Replit."
  );
  process.exit(1);
}

// ============================================
// CLIENTE DISCORD
// ============================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
});

// ============================================
// COMANDOS INICIALES
// ============================================

const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Comprueba si JX Manager está funcionando."),

  new SlashCommandBuilder()
    .setName("ayuda")
    .setDescription("Muestra información sobre JX Manager.")
].map(command => command.toJSON());

// ============================================
// REGISTRO DE COMANDOS
// ============================================

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationCommands(CLIENT_ID),
    { body: commands }
  );

  console.log("Comandos de JX Manager registrados.");
}

// ============================================
// BOT LISTO
// ============================================

client.once(Events.ClientReady, readyClient => {
  console.log(`JX Manager conectado como ${readyClient.user.tag}`);
  console.log(
    `Servidores conectados: ${readyClient.guilds.cache.size}`
  );
});

// ============================================
// INTERACCIONES
// ============================================

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === "ping") {
      const embed = new EmbedBuilder()
        .setColor(0x2589FF)
        .setTitle("🏓 JX Manager • Pong")
        .setDescription(
          "JX Manager está funcionando correctamente."
        )
        .addFields({
          name: "Latencia",
          value: `${client.ws.ping} ms`,
          inline: true
        })
        .setTimestamp();

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral
      });

      return;
    }

    if (interaction.commandName === "ayuda") {
      const embed = new EmbedBuilder()
        .setColor(0x2589FF)
        .setTitle("⚙️ JX Manager")
        .setDescription(
          "Un sistema modular de administración para servidores Discord."
        )
        .addFields(
          {
            name: "🛠️ Disponible",
            value:
              "`/ping` — Comprueba el estado del bot.\n" +
              "`/ayuda` — Muestra esta información."
          },
          {
            name: "🚀 En desarrollo",
            value:
              "Moderación, tickets, comunidad, estadísticas de Staff " +
              "y configuración mediante la Dashboard."
          }
        )
        .setFooter({
          text: "JX Manager • JX Studios"
        })
        .setTimestamp();

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral
      });
    }
  } catch (error) {
    console.error("Error al procesar el comando:", error);

    const response = {
      content: "❌ Ocurrió un error al ejecutar el comando.",
      flags: MessageFlags.Ephemeral
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(response).catch(() => {});
    } else {
      await interaction.reply(response).catch(() => {});
    }
  }
});

// ============================================
// ERRORES
// ============================================

client.on(Events.Error, error => {
  console.error("Error del cliente Discord:", error);
});

process.on("unhandledRejection", error => {
  console.error("Promesa rechazada sin controlar:", error);
});

// ============================================
// INICIO
// ============================================

async function startBot() {
  try {
    await registerCommands();
    await client.login(TOKEN);
  } catch (error) {
    console.error("No se pudo iniciar JX Manager:", error);
    process.exitCode = 1;
  }
}

startBot();