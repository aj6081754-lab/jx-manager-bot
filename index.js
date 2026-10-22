
const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  EmbedBuilder,
  Events,
  REST,
  Routes,
} = require("discord.js");

const supabase = require("./src/supabase");

const {
  getGuildSettings,
} = require("./src/guild-settings");

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token || !clientId) {
  throw new Error(
    "Faltan DISCORD_TOKEN o CLIENT_ID en las variables de entorno."
  );
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Comprueba si JX Manager está funcionando.")
    .setDescriptionLocalizations({
      "en-US": "Check whether JX Manager is running.",
    }),

  new SlashCommandBuilder()
    .setName("ayuda")
    .setDescription("Muestra información sobre JX Manager.")
    .setDescriptionLocalizations({
      "en-US": "Show information about JX Manager.",
    }),
].map((command) => command.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(token);

  await rest.put(Routes.applicationCommands(clientId), {
    body: commands,
  });

  console.log("Comandos /ping y /ayuda registrados.");
}

// Actualiza las estadísticas globales en Supabase.
async function updateBotStats() {
  try {
    const guildCount = client.guilds.cache.size;

    const memberCount = client.guilds.cache.reduce(
      (total, guild) => total + (guild.memberCount || 0),
      0
    );

    const { error } = await supabase
      .from("bot_stats")
      .upsert(
        {
          id: 1,
          guild_count: guildCount,
          member_count: memberCount,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "id",
        }
      );

    if (error) {
      throw error;
    }

    console.log(
      `Estadísticas actualizadas: ${guildCount} servidores | ${memberCount} miembros.`
    );
  } catch (error) {
    console.error(
      "No se pudieron actualizar las estadísticas:",
      error.message
    );
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`JX Manager conectado como ${readyClient.user.tag}.`);

  try {
    await registerCommands();
  } catch (error) {
    console.error("Error registrando comandos:", error.message);
  }

  for (const guild of client.guilds.cache.values()) {
    try {
      const settings = await getGuildSettings(guild.id);

      console.log(
        `Configuración lista: ${guild.name} | Idioma: ${settings.language} | Prefijo: ${settings.prefix}`
      );
    } catch (error) {
      console.error(
        `No se pudo cargar la configuración de ${guild.name}:`,
        error.message
      );
    }
  }

  // Actualización inicial al iniciar el bot.
  await updateBotStats();

  // Actualización periódica cada cinco minutos.
  setInterval(updateBotStats, 5 * 60 * 1000);
});

client.on(Events.GuildCreate, async (guild) => {
  try {
    const settings = await getGuildSettings(guild.id);

    console.log(
      `Nuevo servidor configurado: ${guild.name} | Idioma: ${settings.language} | Prefijo: ${settings.prefix}`
    );
  } catch (error) {
    console.error(
      `No se pudo configurar el nuevo servidor ${guild.name}:`,
      error.message
    );
  }

  await updateBotStats();
});

client.on(Events.GuildDelete, async () => {
  await updateBotStats();
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  let language = "es";

  if (interaction.guildId) {
    try {
      const settings = await getGuildSettings(interaction.guildId);
      language = settings.language;
    } catch (error) {
      console.error("Error leyendo configuración:", error.message);
    }
  }

  if (interaction.commandName === "ping") {
    const latency = Date.now() - interaction.createdTimestamp;
    const apiLatency = Math.round(client.ws.ping);

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle("🏓 JX Manager — Pong!")
      .setDescription(
        language === "en"
          ? "JX Manager is operational."
          : "JX Manager está funcionando correctamente."
      )
      .addFields(
        {
          name:
            language === "en"
              ? "⚡ Response latency"
              : "⚡ Latencia de respuesta",
          value: `${latency} ms`,
          inline: true,
        },
        {
          name:
            language === "en"
              ? "🌐 Discord API latency"
              : "🌐 Latencia de la API de Discord",
          value: `${apiLatency} ms`,
          inline: true,
        },
        {
          name: language === "en" ? "📡 Status" : "📡 Estado",
          value:
            language === "en"
              ? "🟢 Operational"
              : "🟢 Operativo",
          inline: false,
        }
      )
      .setFooter({ text: "JX Manager • JX Studios" })
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  }

  if (interaction.commandName === "ayuda") {
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(
        language === "en"
          ? "JX Manager — Help"
          : "JX Manager — Ayuda"
      )
      .setDescription(
        language === "en"
          ? "Your modular Discord management bot."
          : "Tu bot modular de administración para Discord."
      )
      .addFields(
        {
          name: "/ping",
          value:
            language === "en"
              ? "Checks whether the bot is responding."
              : "Comprueba si el bot responde.",
          inline: false,
        },
        {
          name: "/ayuda",
          value:
            language === "en"
              ? "Shows this help message."
              : "Muestra este mensaje de ayuda.",
          inline: false,
        }
      )
      .setFooter({ text: "JX Manager • JX Studios" });

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  }
});

client.login(token);
