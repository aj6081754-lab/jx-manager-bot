const {
  Client,
  GatewayIntentBits,
  Events,
  EmbedBuilder,
} = require("discord.js");

// =====================================================
// CONFIGURACIÓN
// =====================================================

const OWNER_ID = "1221521143127736351";


const ANNOUNCEMENT_TITLE = "Anuncio Importante • Staff Analitics";

const ANNOUNCEMENT_TEXT = `
Hola, dueños y dueñas de servidores con nuestro bot. Desde el equipo de soporte, agradecemos mucho su apoyo, por eso enviamos este comunicado con algunas cosas que vendran al bot los proximos dias.

## Remodelación interna

Durante los próximos días, el bot entrará en una remodelación interna.

¿Por qué? Detectamos algunos errores en el código que pueden provocar que las alianzas se registren con cantidades infladas. Por ejemplo:

**El Staff hace 1 alianza → el bot registra 2 o más.**

##  Próximas novedades

Además, estamos trabajando en implementar una **dashboard web** y realizar más cambios internos para mejorar el funcionamiento del bot.

Si quieres seguir nuestro progreso y conocer las novedades a medida que avanzamos, puedes unirte a nuestro servidor de soporte:

https://discord.gg/bKCeVqCS2P

¡Muchas gracias por su paciencia y por formar parte de Staff Analitics!
`;

// =====================================================
// CLIENTE
// =====================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ],
});

// =====================================================
// BOT LISTO
// =====================================================

client.once(Events.ClientReady, (readyClient) => {

  console.log(
    `✅ Bot conectado como ${readyClient.user.tag}`
  );

  console.log(
    `🌐 Servidores: ${readyClient.guilds.cache.size}`
  );

});

// =====================================================
// /ANUNCIO
// =====================================================

client.on(Events.InteractionCreate, async (interaction) => {

  if (!interaction.isChatInputCommand()) {
    return;
  }

  if (interaction.commandName !== "anuncio") {
    return;
  }

  // ===================================================
  // COMPROBAR PROPIETARIO
  // ===================================================

  if (interaction.user.id !== OWNER_ID) {

    return interaction.reply({
      content: "❌ No tienes permiso para utilizar este comando.",
      ephemeral: true,
    });

  }

  // ===================================================
  // RESPUESTA INICIAL
  // ===================================================

  await interaction.deferReply({
    ephemeral: true,
  });

  let enviados = 0;
  let fallidos = 0;

  // ===================================================
  // EMBED
  // ===================================================

  const embed = new EmbedBuilder()
    .setTitle(ANNOUNCEMENT_TITLE)
    .setDescription(ANNOUNCEMENT_TEXT)
    .setColor(0x5865F2)
    .setTimestamp();

  // ===================================================
  // RECORRER SERVIDORES
  // ===================================================

  for (const guild of client.guilds.cache.values()) {

    try {

      // -------------------------------------------------
      // BUSCAR CANALES DISPONIBLES
      // -------------------------------------------------

      const me = guild.members.me;

      if (!me) {
        fallidos++;
        continue;
      }

      const canalesDisponibles = guild.channels.cache.filter(
        (channel) => {

          if (!channel.isTextBased()) {
            return false;
          }

          const permisos = channel.permissionsFor(me);

          if (!permisos) {
            return false;
          }

          return (
            permisos.has("ViewChannel") &&
            permisos.has("SendMessages")
          );

        }
      );

      // -------------------------------------------------
      // NO HAY CANALES
      // -------------------------------------------------

      if (canalesDisponibles.size === 0) {

        console.log(
          `⚠️ Sin canal disponible: ${guild.name}`
        );

        fallidos++;
        continue;

      }

      // -------------------------------------------------
      // ELEGIR CANAL ALEATORIO
      // -------------------------------------------------

      const canales = [
        ...canalesDisponibles.values(),
      ];

      const canal =
        canales[
          Math.floor(
            Math.random() * canales.length
          )
        ];

      // -------------------------------------------------
      // ENVIAR
      // -------------------------------------------------

      await canal.send({
        content: `<@${guild.ownerId}>`,
        embeds: [embed],
      });

      enviados++;

      console.log(
        `✅ Anuncio enviado: ${guild.name} → #${canal.name}`
      );

    } catch (error) {

      fallidos++;

      console.error(
        `❌ Error en ${guild.name}:`,
        error.message
      );

    }

  }

  // ===================================================
  // RESULTADO
  // ===================================================

  await interaction.editReply({

    content:
      `📢 **Anuncio terminado**\n\n` +
      `✅ Enviados: **${enviados}**\n` +
      `❌ Fallidos/sin canal: **${fallidos}**`,

  });

});

// =====================================================
// LOGIN
// =====================================================

client.login(
  process.env.DISCORD_TOKEN
);