const db = require("./database");

// =====================================================
// SEMANA ACTUAL
// =====================================================

function getWeekKey(date = new Date()) {

  const d = new Date(
    Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    )
  );

  const day =
    d.getUTCDay() || 7;

  d.setUTCDate(
    d.getUTCDate() + 4 - day
  );

  const yearStart =
    new Date(
      Date.UTC(
        d.getUTCFullYear(),
        0,
        1
      )
    );

  const weekNo =
    Math.ceil(
      (
        (
          d - yearStart
        ) / 86400000 + 1
      ) / 7
    );

  return `${d.getUTCFullYear()}-W${String(
    weekNo
  ).padStart(2, "0")}`;
}


// =====================================================
// DÍA ACTUAL SEGÚN HORA DE REINICIO
// =====================================================

function getDayKey(
  date = new Date(),
  resetHour = 0
) {

  const d =
    new Date(date);

  // Si todavía no llegamos a la hora de reinicio,
  // seguimos perteneciendo al día anterior.

  if (
    d.getHours() <
    resetHour
  ) {

    d.setDate(
      d.getDate() - 1
    );

  }

  const year =
    d.getFullYear();

  const month =
    String(
      d.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      d.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


// =====================================================
// CONFIGURACIÓN DEL SERVIDOR
// =====================================================

function getGuildConfig(
  guildId
) {

  return new Promise(
    (resolve, reject) => {

      db.get(

        `
        SELECT *
        FROM guild_config
        WHERE guild_id = ?
        `,

        [guildId],

        (err, row) => {

          if (err) {

            reject(err);
            return;

          }

          resolve(row);

        }

      );

    }
  );

}


// =====================================================
// TAREAS DE ROLES
// =====================================================
//
// Ahora incluye las tareas de TODOS los roles configurados,
// independientemente de si el rol pertenece a Staff o Admin.
//
// La tabla role_tasks es la que determina qué roles tienen
// tareas configuradas.
//

function getRoleTasks(
  guildId
) {

  return new Promise(
    (resolve, reject) => {

      db.all(

        `
        SELECT *
        FROM role_tasks
        WHERE guild_id = ?
        `,

        [guildId],

        (err, rows) => {

          if (err) {

            reject(err);
            return;

          }

          resolve(
            rows || []
          );

        }

      );

    }
  );

}


// =====================================================
// ROLES STAFF CONFIGURADOS
// =====================================================

function getStaffRoleIds(
  guildId
) {

  return new Promise(
    (resolve, reject) => {

      db.all(

        `
        SELECT role_id
        FROM staff_roles
        WHERE guild_id = ?
        `,

        [guildId],

        (err, rows) => {

          if (err) {

            reject(err);
            return;

          }

          resolve(
            rows || []
          );

        }

      );

    }
  );

}


// =====================================================
// ROLES ADMIN CONFIGURADOS
// =====================================================

function getAdminRoleIds(
  guildId
) {

  return new Promise(
    (resolve, reject) => {

      db.all(

        `
        SELECT role_id
        FROM admin_roles
        WHERE guild_id = ?
        `,

        [guildId],

        (err, rows) => {

          if (err) {

            reject(err);
            return;

          }

          resolve(
            rows || []
          );

        }

      );

    }
  );

}


// =====================================================
// TODOS LOS ROLES CONFIGURADOS
// =====================================================
//
// Combina:
// - Roles de Staff
// - Roles de Admin
//
// Esto permite que ambos tipos de roles puedan tener tareas.
//

async function getConfiguredRoleIds(
  guildId
) {

  const staffRows =
    await getStaffRoleIds(
      guildId
    );

  const adminRows =
    await getAdminRoleIds(
      guildId
    );

  const roleIds = [
    ...staffRows.map(
      row => row.role_id
    ),
    ...adminRows.map(
      row => row.role_id
    ),
  ];

  return [
    ...new Set(
      roleIds
    ),
  ];

}


// =====================================================
// ROL CONFIGURADO MÁS ALTO
// =====================================================
//
// Busca el rol más alto que:
// 1. Tenga tareas configuradas en role_tasks.
// 2. El miembro realmente tenga.
// 3. Sea Staff O Admin.
//
// Esto permite que Admin también tenga tareas.
//

async function getHighestConfiguredRole(
  member
) {

  if (!member) {
    return null;
  }

  const guildId =
    member.guild.id;


  // Obtener roles Staff + Admin configurados.

  const configuredRoleIds =
    await getConfiguredRoleIds(
      guildId
    );


  if (
    configuredRoleIds.length === 0
  ) {

    return null;

  }


  // Obtener únicamente los roles que además
  // tienen tareas configuradas.

  const taskRows =
    await getRoleTasks(
      guildId
    );


  const taskRoleIds =
    new Set(
      taskRows.map(
        task => task.role_id
      )
    );


  // Filtrar únicamente roles que:
  // - estén configurados como Staff/Admin
  // - tengan tareas
  // - pertenezcan al miembro

  const memberRoles =
    configuredRoleIds

      .filter(
        roleId =>
          taskRoleIds.has(
            roleId
          )
      )

      .map(
        roleId =>
          member.guild.roles.cache.get(
            roleId
          )
      )

      .filter(Boolean)

      .filter(
        role =>
          member.roles.cache.has(
            role.id
          )
      );


  if (
    memberRoles.length === 0
  ) {

    return null;

  }


  // El rol con mayor posición es el que determina
  // las tareas del miembro.

  memberRoles.sort(
    (a, b) =>
      b.position - a.position
  );


  return memberRoles[0];

}


// =====================================================
// TAREAS DEL MIEMBRO
// =====================================================
//
// Funciona tanto para Staff como para Admin.
//

async function getMemberTasks(
  member
) {

  const role =
    await getHighestConfiguredRole(
      member
    );


  if (!role) {
    return null;
  }


  return new Promise(
    (resolve, reject) => {

      db.get(

        `
        SELECT *
        FROM role_tasks
        WHERE guild_id = ?
        AND role_id = ?
        `,

        [
          member.guild.id,
          role.id,
        ],

        (err, row) => {

          if (err) {

            reject(err);
            return;

          }

          resolve({

            role,

            tasks:
              row || null,

          });

        }

      );

    }
  );

}


// =====================================================
// ASEGURAR ESTADÍSTICAS SEMANALES
// =====================================================

function ensureWeeklyStats(
  guildId,
  userId,
  week
) {

  return new Promise(
    (resolve, reject) => {

      db.run(

        `
        INSERT OR IGNORE INTO weekly_stats (
          guild_id,
          user_id,
          week,
          messages,
          alliances,
          affiliations
        )
        VALUES (?, ?, ?, 0, 0, 0)
        `,

        [
          guildId,
          userId,
          week,
        ],

        (err) => {

          if (err) {

            reject(err);
            return;

          }

          resolve();

        }

      );

    }
  );

}


// =====================================================
// ASEGURAR ESTADÍSTICAS DIARIAS
// =====================================================

function ensureDailyStats(
  guildId,
  userId,
  day
) {

  return new Promise(
    (resolve, reject) => {

      db.run(

        `
        INSERT OR IGNORE INTO daily_stats (
          guild_id,
          user_id,
          day,
          messages,
          alliances,
          affiliations
        )
        VALUES (?, ?, ?, 0, 0, 0)
        `,

        [
          guildId,
          userId,
          day,
        ],

        (err) => {

          if (err) {

            reject(err);
            return;

          }

          resolve();

        }

      );

    }
  );

}


// =====================================================
// INCREMENTAR ESTADÍSTICA SEMANAL
// =====================================================

function incrementWeeklyStat(
  guildId,
  userId,
  week,
  column,
  amount = 1
) {

  const allowedColumns = [

    "messages",

    "alliances",

    "affiliations",

  ];


  if (
    !allowedColumns.includes(
      column
    )
  ) {

    throw new Error(
      `Columna semanal no permitida: ${column}`
    );

  }


  return new Promise(
    (resolve, reject) => {

      db.run(

        `
        UPDATE weekly_stats
        SET ${column} =
          ${column} + ?
        WHERE guild_id = ?
        AND user_id = ?
        AND week = ?
        `,

        [
          amount,
          guildId,
          userId,
          week,
        ],

        (err) => {

          if (err) {

            reject(err);
            return;

          }

          resolve();

        }

      );

    }
  );

}


// =====================================================
// INCREMENTAR ESTADÍSTICA DIARIA
// =====================================================

function incrementDailyStat(
  guildId,
  userId,
  day,
  column,
  amount = 1
) {

  const allowedColumns = [

    "messages",

    "alliances",

    "affiliations",

  ];


  if (
    !allowedColumns.includes(
      column
    )
  ) {

    throw new Error(
      `Columna diaria no permitida: ${column}`
    );

  }


  return new Promise(
    (resolve, reject) => {

      db.run(

        `
        UPDATE daily_stats
        SET ${column} =
          ${column} + ?
        WHERE guild_id = ?
        AND user_id = ?
        AND day = ?
        `,

        [
          amount,
          guildId,
          userId,
          day,
        ],

        (err) => {

          if (err) {

            reject(err);
            return;

          }

          resolve();

        }

      );

    }
  );

}


// =====================================================
// REGISTRAR ESTADÍSTICA EN DIARIO + SEMANAL
// =====================================================

async function registerStat(
  guildId,
  userId,
  config,
  column,
  amount = 1
) {

  const week =
    getWeekKey();


  const resetHour =
    Number(
      config?.daily_reset_hour ?? 0
    );


  const day =
    getDayKey(
      new Date(),
      resetHour
    );


  // Crear registros si todavía no existen.

  await ensureWeeklyStats(
    guildId,
    userId,
    week
  );


  await ensureDailyStats(
    guildId,
    userId,
    day
  );


  // Incrementar ambos.

  await incrementWeeklyStat(
    guildId,
    userId,
    week,
    column,
    amount
  );


  await incrementDailyStat(
    guildId,
    userId,
    day,
    column,
    amount
  );

}


// =====================================================
// DETECTAR LINKS
// =====================================================

function extractDiscordLinks(
  content
) {

  if (!content) {
    return [];
  }


  const regex =
    /(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite)\/[A-Za-z0-9-]+/gi;


  const matches =
    content.match(
      regex
    );


  if (!matches) {
    return [];
  }


  return [
    ...new Set(
      matches
    ),
  ];

}


// =====================================================
// NORMALIZAR LINK
// =====================================================

function normalizeInviteLink(
  link
) {

  if (
    link.startsWith(
      "http://"
    ) ||
    link.startsWith(
      "https://"
    )
  ) {

    return link;

  }


  return `https://${link}`;

}


// =====================================================
// INFORMACIÓN DE INVITACIÓN
// =====================================================

async function getInviteInfo(
  client,
  link
) {

  try {

    const inviteUrl =
      normalizeInviteLink(
        link
      );


    const invite =
      await client.fetchInvite(
        inviteUrl,
        {
          withCounts: true,
        }
      );


    const serverName =
      invite.guild?.name ||
      "No disponible";


    const memberCount =
      invite.guild?.approximateMemberCount ??
      "No disponible";


    return {

      serverName,

      memberCount,

    };

  } catch (error) {

    console.log(
      `⚠️ No se pudo obtener información de ${link}`
    );


    return {

      serverName:
        "No disponible",

      memberCount:
        "No disponible",

    };

  }

}


// =====================================================
// ENVIAR LOG
// =====================================================

async function sendLog(
  message,
  config,
  type,
  link
) {

  try {

    const channelId =
      type === "alliance"

        ? config.alliance_log_channel_id

        : config.affiliation_log_channel_id;


    if (!channelId) {
      return;
    }


    const logChannel =
      message.guild.channels.cache.get(
        channelId
      );


    if (!logChannel) {
      return;
    }


    const info =
      await getInviteInfo(
        message.client,
        link
      );


    const {
      EmbedBuilder,
    } = require("discord.js");


    const title =
      type === "alliance"

        ? "🤝 Nueva alianza registrada"

        : "🔗 Nueva afiliación registrada";


    const embed =
      new EmbedBuilder()

        .setTitle(
          title
        )

        .setDescription(

          `**Usuario:** ${message.author}\n` +

          `**Servidor:** ${info.serverName}\n` +

          `**Link utilizado:** ${link}\n` +

          `**Miembros:** ${info.memberCount}\n` +

          `**Hora:** <t:${Math.floor(
            Date.now() / 1000
          )}:F>`

        )

        .setTimestamp();


    await logChannel.send({

      embeds: [
        embed
      ],

    });

  } catch (error) {

    console.error(
      "❌ Error enviando log:",
      error
    );

  }

}


// =====================================================
// PROCESAR MENSAJE
// =====================================================
//
// IMPORTANTE:
// Ahora Staff Y Admin pueden generar estadísticas
// siempre que su rol tenga tareas configuradas.
//

async function processMessage(
  message
) {

  try {

    // -----------------------------------------------
    // IGNORAR DMs
    // -----------------------------------------------

    if (!message.guild) {
      return;
    }


    // -----------------------------------------------
    // IGNORAR BOTS
    // -----------------------------------------------

    if (
      message.author.bot
    ) {

      return;

    }


    // -----------------------------------------------
    // CONFIGURACIÓN
    // -----------------------------------------------

    const config =
      await getGuildConfig(
        message.guild.id
      );


    if (!config) {
      return;
    }


    // -----------------------------------------------
    // MIEMBRO
    // -----------------------------------------------

    const member =
      message.member;


    if (!member) {
      return;
    }


    // -----------------------------------------------
    // ROL CONFIGURADO
    // -----------------------------------------------
    //
    // Esto ahora acepta Staff Y Admin.

    const memberData =
      await getMemberTasks(
        member
      );


    if (!memberData) {
      return;
    }


    // =================================================
    // MENSAJE
    // =================================================

    await registerStat(

      message.guild.id,

      message.author.id,

      config,

      "messages",

      1

    );


    console.log(

      `💬 Mensaje contado: ${message.author.tag} | Rol: ${memberData.role.name}`

    );


    // =================================================
    // LINKS
    // =================================================

    const links =
      extractDiscordLinks(
        message.content
      );


    if (
      links.length === 0
    ) {

      return;

    }


    // =================================================
    // ALIANZAS
    // =================================================

    if (

      config.alliance_channel_id &&

      message.channel.id ===
        config.alliance_channel_id

    ) {

      for (
        const link of links
      ) {

        await registerStat(

          message.guild.id,

          message.author.id,

          config,

          "alliances",

          1

        );


        console.log(

          `🤝 Alianza detectada: ${message.author.tag} | ${link}`

        );


        await sendLog(

          message,

          config,

          "alliance",

          link

        );

      }


      return;

    }


    // =================================================
    // AFILIACIONES
    // =================================================

    if (

      config.affiliation_channel_id &&

      message.channel.id ===
        config.affiliation_channel_id

    ) {

      for (
        const link of links
      ) {

        await registerStat(

          message.guild.id,

          message.author.id,

          config,

          "affiliations",

          1

        );


        console.log(

          `🔗 Afiliación detectada: ${message.author.tag} | ${link}`

        );


        await sendLog(

          message,

          config,

          "affiliation",

          link

        );

      }

    }

  } catch (error) {

    console.error(

      "❌ Error procesando mensaje:",

      error

    );

  }

}


// =====================================================
// EXPORTAR
// =====================================================

module.exports = {

  processMessage,

  extractDiscordLinks,

  getWeekKey,

  getDayKey,

  getHighestConfiguredRole,

  getMemberTasks,

};