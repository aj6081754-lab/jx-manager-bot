const {
  Client,
  GatewayIntentBits,
  Events,
  EmbedBuilder,
} = require("discord.js");

const http = require("http");
const STATS_API_KEY = process.env.STATS_API_KEY;

const {
  handleConfigInteraction,
} = require("./src/commands/config");

const {
  processMessage,
  getWeekKey,
  getMemberTasks,
} = require("./src/tracker");

const {
  saveWeeklyHistory,
  getWeeklyHistoryByCode,
} = require("./src/weeklyHistory");

const db = require("./src/database");

// ==================================================
// CLIENTE
// ==================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ==================================================
// TABLA DE HISTORIAL DIARIO
// ==================================================

db.run(
  `
  CREATE TABLE IF NOT EXISTS daily_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    day TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    report_data TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )
  `,
  (err) => {
    if (err) {
      console.error(
        "❌ Error creando daily_history:",
        err
      );
    } else {
      console.log(
        "✅ Tabla daily_history preparada."
      );
    }
  }
);

// ==================================================
// BOT CONECTADO
// ==================================================

client.once(
  Events.ClientReady,
  async (readyClient) => {
    console.log(
      `✅ Bot conectado como ${readyClient.user.tag}`
    );

    try {
      await checkWeeklyHistory(readyClient);
    } catch (error) {
      console.error(
        "❌ Error comprobando historial semanal:",
        error
      );
    }

    try {
      await checkDailyReports(readyClient);
    } catch (error) {
      console.error(
        "❌ Error comprobando reportes diarios:",
        error
      );
    }
  }
);

// ==================================================
// ESTADÍSTICAS SEMANALES
// ==================================================

function getWeeklyStats(
  guildId,
  userId,
  week = getWeekKey()
) {
  return new Promise((resolve, reject) => {
    db.get(
      `
      SELECT *
      FROM weekly_stats
      WHERE guild_id = ?
      AND user_id = ?
      AND week = ?
      `,
      [
        guildId,
        userId,
        week,
      ],
      (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(
          row || {
            messages: 0,
            alliances: 0,
            affiliations: 0,
          }
        );
      }
    );
  });
}

// ==================================================
// ESTADÍSTICAS TOTALES
// ==================================================

function getTotalStats(
  guildId,
  userId
) {
  return new Promise((resolve, reject) => {
    db.get(
      `
      SELECT
        COALESCE(SUM(messages), 0) AS messages,
        COALESCE(SUM(alliances), 0) AS alliances,
        COALESCE(SUM(affiliations), 0) AS affiliations
      FROM weekly_stats
      WHERE guild_id = ?
      AND user_id = ?
      `,
      [
        guildId,
        userId,
      ],
      (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(
          row || {
            messages: 0,
            alliances: 0,
            affiliations: 0,
          }
        );
      }
    );
  });
}

// ==================================================
// MÁXIMO PORCENTAJE HISTÓRICO
// ==================================================
//
// Busca todas las semanas guardadas del servidor
// y obtiene el porcentaje más alto conseguido
// por cada miembro.
//

function getMaximumHistoricalPercentage(
  guildId,
  userId
) {
  return new Promise((resolve, reject) => {
    db.all(
      `
      SELECT report_data
      FROM weekly_history
      WHERE guild_id = ?
      `,
      [
        guildId,
      ],
      (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        let maximum = null;

        for (const row of rows || []) {
          if (!row || !row.report_data) {
            continue;
          }

          let report;

          try {
            report =
              JSON.parse(
                row.report_data
              );
          } catch {
            continue;
          }

          const staff =
            report?.staff || [];

          const member =
            staff.find(
              (entry) =>
                String(entry.user_id) ===
                String(userId)
            );

          if (!member) {
            continue;
          }

          const progress =
            Number(member.progress);

          if (
            !Number.isFinite(progress)
          ) {
            continue;
          }

          if (
            maximum === null ||
            progress > maximum
          ) {
            maximum = progress;
          }
        }

        resolve(maximum);
      }
    );
  });
}

// ==================================================
// DÍA LÓGICO
// ==================================================

function getDayKey(
  date = new Date(),
  resetHour = 0
) {
  const d = new Date(date);

  if (d.getHours() < resetHour) {
    d.setDate(d.getDate() - 1);
  }

  const year = d.getFullYear();

  const month = String(
    d.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    d.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// ==================================================
// ESTADÍSTICAS DIARIAS
// ==================================================

function getDailyStats(
  guildId,
  userId,
  resetHour = 0
) {
  return new Promise((resolve, reject) => {
    const day = getDayKey(
      new Date(),
      resetHour
    );

    db.get(
      `
      SELECT *
      FROM daily_stats
      WHERE guild_id = ?
      AND user_id = ?
      AND day = ?
      `,
      [
        guildId,
        userId,
        day,
      ],
      (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(
          row || {
            messages: 0,
            alliances: 0,
            affiliations: 0,
          }
        );
      }
    );
  });
}

// ==================================================
// CONFIGURACIÓN DEL SERVIDOR
// ==================================================

function getGuildConfig(
  guildId
) {
  return new Promise((resolve, reject) => {
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

        resolve(row || null);
      }
    );
  });
}

// ==================================================
// FORMATO DE TAREA
// ==================================================

function formatTask(
  current,
  required
) {
  if (
    required === undefined ||
    required === null ||
    Number(required) === 0
  ) {
    return "No disponible";
  }

  return `${Number(current || 0)}/${Number(required)}`;
}

// ==================================================
// PORCENTAJE INDIVIDUAL
// ==================================================

function calculateIndividualPercentage(
  current,
  required
) {
  if (
    required === undefined ||
    required === null ||
    Number(required) <= 0
  ) {
    return null;
  }

  const percentage =
    (Number(current || 0) / Number(required)) * 100;

  return Math.min(
    100,
    Math.round(percentage)
  );
}

// ==================================================
// P-M-D CON PESOS
// ==================================================

function calculateProgress(
  stats,
  tasks
) {
  const messages =
    calculateIndividualPercentage(
      stats.messages,
      tasks.messages_required
    );

  const alliances =
    calculateIndividualPercentage(
      stats.alliances,
      tasks.alliances_required
    );

  const affiliations =
    calculateIndividualPercentage(
      stats.affiliations,
      tasks.affiliations_required
    );

  if (
    messages === null &&
    alliances === null &&
    affiliations === null
  ) {
    return null;
  }

  let total = 0;

  if (messages !== null) {
    total += messages * 0.50;
  }

  if (alliances !== null) {
    total += alliances * 0.25;
  }

  if (affiliations !== null) {
    total += affiliations * 0.25;
  }

  return Math.round(total);
}

// ==================================================
// ESTADO P-M-D
// ==================================================

function getPMDStatus(
  percentage
) {
  if (percentage === null) {
    return {
      label: "NO DISPONIBLE",
      emoji: "⚪",
    };
  }

  if (percentage >= 85) {
    return {
      label: "SUBIR",
      emoji: "🟢",
    };
  }

  if (percentage <= 45) {
    return {
      label: "BAJAR",
      emoji: "🔴",
    };
  }

  return {
    label: "MANTENER",
    emoji: "🟡",
  };
}

// ==================================================
// ROLES STAFF
// ==================================================

function getStaffRoleIds(
  guildId
) {
  return new Promise((resolve, reject) => {
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

        resolve(rows || []);
      }
    );
  });
}

// ==================================================
// ROLES ADMIN
// ==================================================

function getAdminRoleIds(
  guildId
) {
  return new Promise((resolve, reject) => {
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

        resolve(rows || []);
      }
    );
  });
}

// ==================================================
// MIEMBROS STAFF
// ==================================================

async function getStaffMembers(
  guild
) {
  const rows = await getStaffRoleIds(
    guild.id
  );

  if (rows.length === 0) {
    return new Map();
  }

  const members = new Map();

  for (const row of rows) {
    const role = guild.roles.cache.get(
      row.role_id
    );

    if (!role) {
      continue;
    }

    for (const member of role.members.values()) {
      members.set(
        member.id,
        member
      );
    }
  }

  return members;
}

// ==================================================
// MIEMBROS ADMIN
// ==================================================

async function getAdminMembers(
  guild
) {
  const rows = await getAdminRoleIds(
    guild.id
  );

  if (rows.length === 0) {
    return new Map();
  }

  const members = new Map();

  for (const row of rows) {
    const role = guild.roles.cache.get(
      row.role_id
    );

    if (!role) {
      continue;
    }

    for (const member of role.members.values()) {
      members.set(
        member.id,
        member
      );
    }
  }

  return members;
}

// ==================================================
// MIEMBROS EVALUABLES
// ==================================================

async function getEvaluableMembers(
  guild
) {
  const staffMembers =
    await getStaffMembers(guild);

  const adminMembers =
    await getAdminMembers(guild);

  const members = new Map();

  for (const member of staffMembers.values()) {
    members.set(
      member.id,
      member
    );
  }

  for (const member of adminMembers.values()) {
    members.set(
      member.id,
      member
    );
  }

  const evaluable = new Map();

  for (const member of members.values()) {
    const memberData =
      await getMemberTasks(member);

    if (memberData) {
      evaluable.set(
        member.id,
        member
      );
    }
  }

  return evaluable;
}

// ==================================================
// HISTORIAL SEMANAL
// ==================================================

let lastCheckedWeek = null;

function getPreviousWeekKey() {
  const now = new Date();

  now.setDate(
    now.getDate() - 7
  );

  const year = now.getFullYear();

  const start = new Date(
    year,
    0,
    1
  );

  const diff = Math.floor(
    (now - start) / 86400000
  );

  const week = Math.floor(
    (diff + start.getDay() + 6) / 7
  );

  return `${year}-W${String(
    week
  ).padStart(2, "0")}`;
}

// ==================================================
// TODAS LAS ESTADÍSTICAS DE UNA SEMANA
// ==================================================

function getAllWeeklyStats(
  guildId,
  week
) {
  return new Promise((resolve, reject) => {
    db.all(
      `
      SELECT
        user_id,
        messages,
        alliances,
        affiliations
      FROM weekly_stats
      WHERE guild_id = ?
      AND week = ?
      `,
      [
        guildId,
        week,
      ],
      (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(rows || []);
      }
    );
  });
}

// ==================================================
// DATOS DEL REPORTE SEMANAL
// ==================================================

async function createWeeklyReportData(
  guild,
  week
) {
  const members =
    await getEvaluableMembers(guild);

  const statsRows =
    await getAllWeeklyStats(
      guild.id,
      week
    );

  const statsMap = new Map();

  for (const row of statsRows) {
    statsMap.set(
      row.user_id,
      row
    );
  }

  const staff = [];

  for (const member of members.values()) {
    const memberData =
      await getMemberTasks(member);

    if (!memberData) {
      continue;
    }

    const stats =
      statsMap.get(member.id) || {
        messages: 0,
        alliances: 0,
        affiliations: 0,
      };

    const progress =
      calculateProgress(
        stats,
        memberData.tasks
      );

    const status =
      getPMDStatus(progress);

    staff.push({
      user_id: member.id,
      username: member.user.tag,
      role_id: memberData.role.id,

      messages: Number(
        stats.messages || 0
      ),

      alliances: Number(
        stats.alliances || 0
      ),

      affiliations: Number(
        stats.affiliations || 0
      ),

      progress,
      status: status.label,
    });
  }

  return {
    guild_id: guild.id,
    guild_name: guild.name,
    week,
    generated_at: Date.now(),
    staff,
  };
}

// ==================================================
// EMBED DEL REPORTE SEMANAL
// ==================================================

function createWeeklyHistoryEmbed(
  report,
  code
) {
  const staff =
    report.staff || [];

  if (staff.length === 0) {
    return new EmbedBuilder()
      .setTitle("📋 Historial semanal")
      .setDescription(
        `**Semana:** ${report.week}\n\n` +
        `No hubo miembros Staff/Admin con tareas registradas.`
      )
      .addFields({
        name: "🔐 Código",
        value: `\`${code}\``,
        inline: false,
      })
      .setTimestamp();
  }

  const lines = staff.map(
    (member, index) => {
      return (
        `**${index + 1}. <@${member.user_id}>**\n` +
        `🏅 <@&${member.role_id}>\n` +
        `🤝 Alianzas: **${member.alliances}**\n` +
        `🔗 Afiliaciones: **${member.affiliations}**\n` +
        `💬 Mensajes: **${member.messages}**\n` +
        `📊 Progreso: **${
          member.progress === null
            ? "N/A"
            : `${member.progress}%`
        }**`
      );
    }
  );

  let description =
    lines.join("\n\n");

  if (description.length > 4000) {
    description =
      description.substring(0, 4000) +
      "\n\n...";
  }

  return new EmbedBuilder()
    .setTitle("📋 Reporte semanal del Staff")
    .setDescription(
      `**Semana:** ${report.week}\n\n` +
      description
    )
    .addFields({
      name: "🔐 Código de historial",
      value: `\`${code}\``,
      inline: false,
    })
    .setFooter({
      text:
        "Usa /historial con este código para consultar esta semana.",
    })
    .setTimestamp();
}

// ==================================================
// GUARDAR Y PUBLICAR SEMANA
// ==================================================

async function saveAndPublishWeeklyHistory(
  guild,
  week
) {
  const reportData =
    await createWeeklyReportData(
      guild,
      week
    );

  const history =
    await saveWeeklyHistory(
      guild.id,
      week,
      reportData
    );

  console.log(
    `✅ Historial guardado: ${guild.name} | ${week} | ${history.code}`
  );

  const config =
    await getGuildConfig(guild.id);

  if (
    !config ||
    !config.weekly_report_channel_id
  ) {
    console.log(
      `⚠️ ${guild.name} no tiene canal de reporte semanal configurado.`
    );

    return history;
  }

  const channel =
    guild.channels.cache.get(
      config.weekly_report_channel_id
    ) ||
    await guild.channels.fetch(
      config.weekly_report_channel_id
    ).catch(() => null);

  if (!channel) {
    console.log(
      `⚠️ No se encontró el canal semanal en ${guild.name}.`
    );

    return history;
  }

  const embed =
    createWeeklyHistoryEmbed(
      reportData,
      history.code
    );

  await channel.send({
    embeds: [embed],
  });

  console.log(
    `📤 Reporte semanal publicado en ${guild.name} | ${history.code}`
  );

  return history;
}

// ==================================================
// COMPROBAR CAMBIO DE SEMANA
// ==================================================

async function checkWeeklyHistory(
  readyClient
) {
  const currentWeek =
    getWeekKey();

  if (lastCheckedWeek === null) {
    lastCheckedWeek =
      currentWeek;

    console.log(
      `📅 Semana actual: ${currentWeek}`
    );

    return;
  }

  if (lastCheckedWeek === currentWeek) {
    return;
  }

  const previousWeek =
    lastCheckedWeek;

  console.log(
    `🔄 Nueva semana detectada: ${currentWeek}`
  );

  console.log(
    `📦 Cerrando semana anterior: ${previousWeek}`
  );

  lastCheckedWeek =
    currentWeek;

  for (
    const guild of readyClient.guilds.cache.values()
  ) {
    try {
      await saveAndPublishWeeklyHistory(
        guild,
        previousWeek
      );
    } catch (error) {
      console.error(
        `❌ Error guardando semana ${previousWeek} en ${guild.name}:`,
        error
      );
    }
  }
}

// ==================================================
// HISTORIAL DIARIO
// ==================================================

function generateDailyHistoryCode() {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "D-";

  for (let i = 0; i < 6; i++) {
    code +=
      chars[
        Math.floor(
          Math.random() * chars.length
        )
      ];
  }

  return code;
}

// ==================================================
// HISTORIAL DIARIO POR DÍA
// ==================================================

function getDailyHistoryByDay(
  guildId,
  day
) {
  return new Promise((resolve, reject) => {
    db.get(
      `
      SELECT *
      FROM daily_history
      WHERE guild_id = ?
      AND day = ?
      `,
      [
        guildId,
        day,
      ],
      (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        let reportData = {};

        try {
          reportData =
            JSON.parse(
              row.report_data
            );
        } catch {
          reportData = {};
        }

        resolve({
          ...row,
          report_data: reportData,
        });
      }
    );
  });
}

// ==================================================
// HISTORIAL DIARIO POR CÓDIGO
// ==================================================

function getDailyHistoryByCode(
  guildId,
  code
) {
  return new Promise((resolve, reject) => {
    db.get(
      `
      SELECT *
      FROM daily_history
      WHERE guild_id = ?
      AND code = ?
      `,
      [
        guildId,
        code,
      ],
      (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        let reportData = {};

        try {
          reportData =
            JSON.parse(
              row.report_data
            );
        } catch {
          reportData = {};
        }

        resolve({
          ...row,
          report_data: reportData,
        });
      }
    );
  });
}

// ==================================================
// GUARDAR HISTORIAL DIARIO
// ==================================================

function saveDailyHistory(
  guildId,
  day,
  reportData
) {
  return new Promise((resolve, reject) => {
    const attemptSave = () => {
      const code =
        generateDailyHistoryCode();

      db.run(
        `
        INSERT INTO daily_history
        (
          guild_id,
          day,
          code,
          report_data,
          created_at
        )
        VALUES (?, ?, ?, ?, ?)
        `,
        [
          guildId,
          day,
          code,
          JSON.stringify(reportData),
          Date.now(),
        ],
        function (err) {
          if (err) {
            if (
              String(
                err.message || ""
              )
                .toLowerCase()
                .includes("unique")
            ) {
              attemptSave();
              return;
            }

            reject(err);
            return;
          }

          resolve({
            id: this.lastID,
            guild_id: guildId,
            day,
            code,
            report_data: reportData,
          });
        }
      );
    };

    attemptSave();
  });
}

// ==================================================
// ESTADÍSTICAS DIARIAS POR FECHA
// ==================================================

function getDailyStatsByDay(
  guildId,
  userId,
  day
) {
  return new Promise((resolve, reject) => {
    db.get(
      `
      SELECT *
      FROM daily_stats
      WHERE guild_id = ?
      AND user_id = ?
      AND day = ?
      `,
      [
        guildId,
        userId,
        day,
      ],
      (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(
          row || {
            messages: 0,
            alliances: 0,
            affiliations: 0,
          }
        );
      }
    );
  });
}

// ==================================================
// DATOS DEL REPORTE DIARIO
// ==================================================

async function createDailyReportData(
  guild,
  day,
  resetHour
) {
  const members =
    await getEvaluableMembers(guild);

  const staff = [];

  for (const member of members.values()) {
    const memberData =
      await getMemberTasks(member);

    if (!memberData) {
      continue;
    }

    const stats =
      await getDailyStatsByDay(
        guild.id,
        member.id,
        day
      );

    const progress =
      calculateProgress(
        stats,
        memberData.tasks
      );

    const status =
      getPMDStatus(progress);

    staff.push({
      user_id: member.id,
      username: member.user.tag,
      role_id: memberData.role.id,

      messages: Number(
        stats.messages || 0
      ),

      alliances: Number(
        stats.alliances || 0
      ),

      affiliations: Number(
        stats.affiliations || 0
      ),

      progress,
      status: status.label,
    });
  }

  return {
    guild_id: guild.id,
    guild_name: guild.name,
    day,
    reset_hour: resetHour,
    generated_at: Date.now(),
    staff,
  };
}

// ==================================================
// EMBED DEL REPORTE DIARIO
// ==================================================

function createDailyReportEmbed(
  report,
  code
) {
  const staff =
    report.staff || [];

  if (staff.length === 0) {
    return new EmbedBuilder()
      .setTitle("📋 Reporte diario del Staff")
      .setDescription(
        `**Día:** ${report.day}\n\n` +
        "No hubo miembros Staff/Admin con tareas configuradas."
      )
      .addFields({
        name: "🔐 Código de historial",
        value: `\`${code}\``,
        inline: false,
      })
      .setFooter({
        text:
          "Usa /historial-diario con este código.",
      })
      .setTimestamp();
  }

  const lines = staff.map(
    (member, index) => {
      return (
        `**${index + 1}. <@${member.user_id}>**\n` +
        `🏅 <@&${member.role_id}>\n` +
        `🤝 Alianzas: **${member.alliances}**\n` +
        `🔗 Afiliaciones: **${member.affiliations}**\n` +
        `💬 Mensajes: **${member.messages}**\n` +
        `📊 Progreso: **${
          member.progress === null
            ? "N/A"
            : `${member.progress}%`
        }**\n` +
        `📋 Estado: **${member.status}**`
      );
    }
  );

  let description =
    lines.join("\n\n");

  if (description.length > 4000) {
    description =
      description.substring(0, 4000) +
      "\n\n...";
  }

  return new EmbedBuilder()
    .setTitle("📋 Reporte diario del Staff")
    .setDescription(
      `**Día:** ${report.day}\n\n` +
      description
    )
    .addFields({
      name: "🔐 Código de historial",
      value: `\`${code}\``,
      inline: false,
    })
    .setFooter({
      text:
        "Reporte diario automático • Mensajes 50% • Alianzas 25% • Afiliaciones 25%",
    })
    .setTimestamp();
}

// ==================================================
// CANAL DE REPORTE DIARIO
// ==================================================

async function getDailyReportChannel(
  guild,
  config
) {
  if (
    !config ||
    !config.daily_report_channel_id
  ) {
    return null;
  }

  const channel =
    guild.channels.cache.get(
      config.daily_report_channel_id
    ) ||
    await guild.channels.fetch(
      config.daily_report_channel_id
    ).catch(() => null);

  return channel;
}

// ==================================================
// GUARDAR Y PUBLICAR REPORTE DIARIO
// ==================================================

async function saveAndPublishDailyReport(
  guild,
  dayOverride = null,
  force = false
) {
  const config =
    await getGuildConfig(guild.id);

  const resetHour =
    Number(
      config?.daily_reset_hour || 0
    );

  const day =
    dayOverride ||
    getDayKey(
      new Date(
        Date.now() - 86400000
      ),
      resetHour
    );

  const existing =
    await getDailyHistoryByDay(
      guild.id,
      day
    );

  if (existing && !force) {
    console.log(
      `ℹ️ El reporte diario ${day} ya existe en ${guild.name} | ${existing.code}`
    );

    return existing;
  }

  const reportData =
    await createDailyReportData(
      guild,
      day,
      resetHour
    );

  let history;

  if (!existing) {
    history =
      await saveDailyHistory(
        guild.id,
        day,
        reportData
      );
  } else {
    history = existing;
  }

  console.log(
    `✅ Historial diario guardado: ${guild.name} | ${day} | ${history.code}`
  );

  const channel =
    await getDailyReportChannel(
      guild,
      config
    );

  if (!channel) {
    console.log(
      `⚠️ ${guild.name} no tiene canal de reporte diario configurado.`
    );

    return history;
  }

  const embed =
    createDailyReportEmbed(
      reportData,
      history.code
    );

  await channel.send({
    embeds: [embed],
  });

  console.log(
    `📤 Reporte diario publicado: ${guild.name} | ${day} | ${history.code}`
  );

  return history;
}

// ==================================================
// COMPROBAR REPORTES DIARIOS
// ==================================================

async function checkDailyReports(
  readyClient
) {
  for (
    const guild of readyClient.guilds.cache.values()
  ) {
    try {
      const config =
        await getGuildConfig(guild.id);

      const resetHour =
        Number(
          config?.daily_reset_hour || 0
        );

      const previousDate =
        new Date();

      previousDate.setDate(
        previousDate.getDate() - 1
      );

      const previousDay =
        getDayKey(
          previousDate,
          resetHour
        );

      const existing =
        await getDailyHistoryByDay(
          guild.id,
          previousDay
        );

      if (existing) {
        continue;
      }

      console.log(
        `📅 Falta el reporte diario de ${guild.name}: ${previousDay}`
      );

      await saveAndPublishDailyReport(
        guild,
        previousDay
      );

      console.log(
        `✅ Día cerrado automáticamente: ${guild.name} | ${previousDay}`
      );
    } catch (error) {
      console.error(
        `❌ Error comprobando reporte diario en ${guild.name}:`,
        error
      );
    }
  }
}

// ==================================================
// /REPORTE-DIARIO-TEST
// ==================================================

async function handleDailyReportTest(
  interaction
) {
  try {
    await interaction.deferReply({
      ephemeral: true,
    });

    const config =
      await getGuildConfig(
        interaction.guild.id
      );

    const resetHour =
      Number(
        config?.daily_reset_hour || 0
      );

    const currentDay =
      getDayKey(
        new Date(),
        resetHour
      );

    const reportData =
      await createDailyReportData(
        interaction.guild,
        currentDay,
        resetHour
      );

    const history =
      await saveDailyHistory(
        interaction.guild.id,
        `${currentDay}-TEST-${Date.now()}`,
        reportData
      );

    const channel =
      await getDailyReportChannel(
        interaction.guild,
        config
      );

    if (!channel) {
      await interaction.editReply({
        content:
          "⚠️ El reporte fue generado y guardado, pero no hay un canal de reporte diario configurado.\n\n" +
          `Día: \`${currentDay}\`\n` +
          `Código: \`${history.code}\``,
      });

      return;
    }

    const embed =
      createDailyReportEmbed(
        reportData,
        history.code
      );

    embed
      .setTitle(
        "🧪 Reporte diario de prueba"
      )
      .setFooter({
        text:
          "Reporte generado mediante /reporte-diario-test",
      });

    await channel.send({
      embeds: [embed],
    });

    await interaction.editReply({
      content:
        `✅ Reporte diario de prueba enviado correctamente.\n\n` +
        `📅 Día: \`${currentDay}\`\n` +
        `🔐 Código: \`${history.code}\`\n` +
        `📢 Canal: <#${channel.id}>`,
    });
  } catch (error) {
    console.error(
      "❌ Error en reporte diario de prueba:",
      error
    );

    if (interaction.deferred) {
      await interaction.editReply({
        content:
          "❌ No se pudo generar el reporte diario de prueba.",
      });
    } else if (!interaction.replied) {
      await interaction.reply({
        content:
          "❌ No se pudo generar el reporte diario de prueba.",
        ephemeral: true,
      });
    }
  }
}

// ==================================================
// /HISTORIAL-DIARIO
// ==================================================

async function handleHistorialDiario(
  interaction
) {
  const code =
    interaction.options
      .getString("codigo")
      ?.trim()
      .toUpperCase();

  if (!code) {
    await interaction.reply({
      content:
        "❌ Debes introducir el código del reporte diario.",
      ephemeral: true,
    });

    return;
  }

  const history =
    await getDailyHistoryByCode(
      interaction.guild.id,
      code
    );

  if (!history) {
    await interaction.reply({
      content:
        "❌ No se encontró ningún reporte diario con ese código.",
      ephemeral: true,
    });

    return;
  }

  const report =
    history.report_data || {};

  const staff =
    report.staff || [];

  if (staff.length === 0) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(
            "📋 Historial diario"
          )
          .setDescription(
            `**Día:** ${history.day}\n\n` +
            "No hay estadísticas registradas para este día."
          )
          .addFields({
            name: "🔐 Código",
            value: `\`${history.code}\``,
          })
          .setTimestamp(),
      ],
    });

    return;
  }

  const lines = staff.map(
    (member, index) => {
      return (
        `**${index + 1}. <@${member.user_id}>**\n` +
        `🏅 <@&${member.role_id}>\n` +
        `🤝 Alianzas: **${member.alliances}**\n` +
        `🔗 Afiliaciones: **${member.affiliations}**\n` +
        `💬 Mensajes: **${member.messages}**\n` +
        `📊 Progreso: **${
          member.progress === null
            ? "N/A"
            : `${member.progress}%`
        }**\n` +
        `📋 Estado: **${member.status}**`
      );
    }
  );

  let description =
    lines.join("\n\n");

  if (description.length > 4000) {
    description =
      description.substring(0, 4000) +
      "\n\n...";
  }

  const embed =
    new EmbedBuilder()
      .setTitle("📋 Historial diario")
      .setDescription(
        `**Día:** ${history.day}\n\n` +
        description
      )
      .addFields({
        name: "🔐 Código",
        value: `\`${history.code}\``,
      })
      .setFooter({
        text:
          "Historial diario guardado permanentemente.",
      })
      .setTimestamp();

  await interaction.reply({
    embeds: [embed],
  });
}

// ==================================================
// /PROGRESO
// ==================================================

async function handleProgreso(
  interaction
) {
  const targetUser =
    interaction.options.getUser("user") ||
    interaction.user;

  const member =
    await interaction.guild.members
      .fetch(targetUser.id)
      .catch(() => null);

  if (!member) {
    await interaction.reply({
      content:
        "❌ No se pudo encontrar a ese usuario en el servidor.",
    });

    return;
  }

  const memberData =
    await getMemberTasks(member);

  if (!memberData) {
    await interaction.reply({
      content:
        "❌ Ese usuario no tiene un rol Staff/Admin con tareas configuradas.",
    });

    return;
  }

  const config =
    await getGuildConfig(
      interaction.guild.id
    );

  const resetHour =
    Number(
      config?.daily_reset_hour || 0
    );

  const stats =
    await getDailyStats(
      interaction.guild.id,
      targetUser.id,
      resetHour
    );
  
  const tasks =
    memberData.tasks;

  const embed =
    new EmbedBuilder()
      .setTitle("📊 Progreso del Staff")
      .setDescription(
        `**Staff:** ${targetUser}\n\n` +
        `🤝 **Alianzas:** ${formatTask(
          stats.alliances,
          tasks.alliances_required
        )}\n` +
        `🔗 **Afiliaciones:** ${formatTask(
          stats.affiliations,
          tasks.affiliations_required
        )}\n` +
        `💬 **Mensajes:** ${formatTask(
          stats.messages,
          tasks.messages_required
        )}\n\n` +
        `🏅 **Rol:** <@&${memberData.role.id}>`
      )
      .setTimestamp();

  await interaction.reply({
    embeds: [embed],
  });
}

// ==================================================
// /PROGRESO-SEMANAL
// ==================================================

async function handleProgresoSemanal(
  interaction
) {
  const members =
    await getEvaluableMembers(
      interaction.guild
    );

  if (members.size === 0) {
    await interaction.reply({
      content:
        "❌ No hay miembros Staff/Admin con tareas configuradas.",
    });

    return;
  }

  const lines = [];

  for (const member of members.values()) {
    const memberData =
      await getMemberTasks(member);

    if (!memberData) {
      continue;
    }

    const stats =
      await getWeeklyStats(
        interaction.guild.id,
        member.id
      );

    const tasks =
      memberData.tasks;

    lines.push(
      `**${member}**\n` +
      `🏅 Rol: <@&${memberData.role.id}>\n` +
      `🤝 Alianzas: ${formatTask(
        stats.alliances,
        tasks.alliances_required
      )}\n` +
      `🔗 Afiliaciones: ${formatTask(
        stats.affiliations,
        tasks.affiliations_required
      )}\n` +
      `💬 Mensajes: ${formatTask(
        stats.messages,
        tasks.messages_required
      )}`
    );
  }

  if (lines.length === 0) {
    await interaction.reply({
      content:
        "❌ Ningún miembro tiene tareas configuradas.",
    });

    return;
  }

  const embed =
    new EmbedBuilder()
      .setTitle(
        "📈 Progreso semanal del Staff"
      )
      .setDescription(
        lines.join("\n\n")
      )
      .setTimestamp();

  await interaction.reply({
    embeds: [embed],
  });
}

// ==================================================
// /PROGRESO-DIARIO
// ==================================================

async function handleProgresoDiario(
  interaction
) {
  const config =
    await getGuildConfig(
      interaction.guild.id
    );

  const members =
    await getEvaluableMembers(
      interaction.guild
    );

  if (members.size === 0) {
    await interaction.reply({
      content:
        "❌ No hay miembros Staff/Admin con tareas configuradas.",
    });

    return;
  }

  const resetHour =
    Number(
      config?.daily_reset_hour || 0
    );

  const lines = [];

  for (const member of members.values()) {
    const memberData =
      await getMemberTasks(member);

    if (!memberData) {
      continue;
    }

    const stats =
      await getDailyStats(
        interaction.guild.id,
        member.id,
        resetHour
      );

    const tasks =
      memberData.tasks;

    lines.push(
      `**${member}**\n` +
      `🏅 Rol: <@&${memberData.role.id}>\n` +
      `🤝 Alianzas: ${formatTask(
        stats.alliances,
        tasks.alliances_required
      )}\n` +
      `🔗 Afiliaciones: ${formatTask(
        stats.affiliations,
        tasks.affiliations_required
      )}\n` +
      `💬 Mensajes: ${formatTask(
        stats.messages,
        tasks.messages_required
      )}`
    );
  }

  if (lines.length === 0) {
    await interaction.reply({
      content:
        "❌ Ningún miembro tiene tareas configuradas.",
    });

    return;
  }

  const embed =
    new EmbedBuilder()
      .setTitle(
        "📊 Progreso diario del Staff"
      )
      .setDescription(
        lines.join("\n\n")
      )
      .setTimestamp();

  await interaction.reply({
    embeds: [embed],
  });
}

// ==================================================
// RANKINGS ANTERIORES
// ==================================================

async function getRankingData(
  interaction,
  stat
) {
  const members =
    await getEvaluableMembers(
      interaction.guild
    );

  if (
    !members ||
    members.size === 0
  ) {
    return [];
  }

  const ranking = [];

  for (const member of members.values()) {
    const weekly =
      await getWeeklyStats(
        interaction.guild.id,
        member.id
      );

    const total =
      await getTotalStats(
        interaction.guild.id,
        member.id
      );

    ranking.push({
      member,

      weekly: Number(
        weekly[stat] || 0
      ),

      total: Number(
        total[stat] || 0
      ),
    });
  }

  ranking.sort(
    (a, b) =>
      b.weekly - a.weekly ||
      b.total - a.total
  );

  return ranking;
}

// ==================================================
// MOSTRAR RANKING ANTERIOR
// ==================================================

async function handleRanking(
  interaction,
  stat,
  title,
  icon
) {
  const ranking =
    await getRankingData(
      interaction,
      stat
    );

  if (ranking.length === 0) {
    await interaction.reply({
      content:
        "❌ No hay miembros Staff/Admin con tareas configuradas para mostrar.",
    });

    return;
  }

  const lines =
    ranking.map(
      (entry, index) => {
        return (
          `**${index + 1}. ${entry.member}**\n` +
          `${icon} Totales: **${entry.total}**\n` +
          `${icon} Esta semana: **${entry.weekly}**`
        );
      }
    );

  const embed =
    new EmbedBuilder()
      .setTitle(title)
      .setDescription(
        lines.join("\n\n")
      )
      .setTimestamp();

  await interaction.reply({
    embeds: [embed],
  });
}

// ==================================================
// /RANKING GENERAL
// ==================================================

async function handleGeneralRanking(
  interaction
) {
  const members =
    await getEvaluableMembers(
      interaction.guild
    );

  if (
    !members ||
    members.size === 0
  ) {
    await interaction.reply({
      content:
        "❌ No hay miembros Staff/Admin con tareas configuradas para mostrar.",
      ephemeral: true,
    });

    return;
  }

  const ranking = [];

  for (const member of members.values()) {
    const total =
      await getTotalStats(
        interaction.guild.id,
        member.id
      );

    const maximumPercentage =
      await getMaximumHistoricalPercentage(
        interaction.guild.id,
        member.id
      );

    ranking.push({
      member,

      messages: Number(
        total?.messages || 0
      ),

      alliances: Number(
        total?.alliances || 0
      ),

      affiliations: Number(
        total?.affiliations || 0
      ),

      maximumPercentage:
        maximumPercentage === null
          ? null
          : Number(
              maximumPercentage
            ),
    });
  }

  // ==================================================
  // ORDEN DEL RANKING
  // ==================================================
  //
  // 1. Mayor porcentaje máximo
  // 2. Más mensajes totales
  // 3. Más alianzas totales
  // 4. Más afiliaciones totales
  //

  ranking.sort(
    (a, b) => {
      const aPercentage =
        a.maximumPercentage === null
          ? -1
          : a.maximumPercentage;

      const bPercentage =
        b.maximumPercentage === null
          ? -1
          : b.maximumPercentage;

      return (
        bPercentage -
          aPercentage ||

        b.messages -
          a.messages ||

        b.alliances -
          a.alliances ||

        b.affiliations -
          a.affiliations
      );
    }
  );

  const lines =
    ranking.map(
      (entry, index) => {
        return (
          `**#${index + 1}**\n` +
          `**Staff:** ${entry.member}\n` +
          `**Id:** \`${entry.member.id}\`\n` +
          `**Mensajes totales:** ${entry.messages.toLocaleString("es-ES")}\n` +
          `**Alianzas totales:** ${entry.alliances.toLocaleString("es-ES")}\n` +
          `**Afiliaciones totales:** ${entry.affiliations.toLocaleString("es-ES")}\n` +
          `**Máximo porcentaje:** ${
            entry.maximumPercentage === null
              ? "N/A"
              : `${entry.maximumPercentage}%`
          }`
        );
      }
    );

  let description =
    lines.join("\n\n");

  // Discord permite 4096 caracteres en description.
  if (description.length > 4000) {
    description =
      description.substring(0, 4000) +
      "\n\n...";
  }

  const embed =
    new EmbedBuilder()
      .setTitle("🏆 Ranking General del Staff")
      .setDescription(
        description
      )
      .setFooter({
        text:
          "Estadísticas acumuladas de todas las semanas guardadas.",
      })
      .setTimestamp();

  await interaction.reply({
    embeds: [embed],
  });
}

// ==================================================
// /P-M-D
// ==================================================

async function handlePMD(
  interaction
) {
  const members =
    await getEvaluableMembers(
      interaction.guild
    );

  if (
    !members ||
    members.size === 0
  ) {
    await interaction.reply({
      content:
        "❌ No hay miembros Staff/Admin con tareas configuradas.",
    });

    return;
  }

  const subir = [];
  const mantener = [];
  const bajar = [];
  const noDisponible = [];

  for (const member of members.values()) {
    const memberData =
      await getMemberTasks(member);

    if (!memberData) {
      continue;
    }

    const stats =
      await getWeeklyStats(
        interaction.guild.id,
        member.id
      );

    const percentage =
      calculateProgress(
        stats,
        memberData.tasks
      );

    const status =
      getPMDStatus(
        percentage
      );

    const line =
      `${member} — **${
        percentage === null
          ? "N/A"
          : percentage
      }%** — <@&${memberData.role.id}>`;

    if (status.label === "SUBIR") {
      subir.push(
        `${status.emoji} ${line}`
      );
    } else if (
      status.label === "MANTENER"
    ) {
      mantener.push(
        `${status.emoji} ${line}`
      );
    } else if (
      status.label === "BAJAR"
    ) {
      bajar.push(
        `${status.emoji} ${line}`
      );
    } else {
      noDisponible.push(
        `${status.emoji} ${member} — <@&${memberData.role.id}>`
      );
    }
  }

  if (
    subir.length === 0 &&
    mantener.length === 0 &&
    bajar.length === 0 &&
    noDisponible.length === 0
  ) {
    await interaction.reply({
      content:
        "❌ Ningún miembro tiene tareas configuradas.",
    });

    return;
  }

  const sections = [];

  if (subir.length > 0) {
    sections.push(
      `## 🟢 SUBIR\n${subir.join("\n")}`
    );
  }

  if (mantener.length > 0) {
    sections.push(
      `## 🟡 MANTENER\n${mantener.join("\n")}`
    );
  }

  if (bajar.length > 0) {
    sections.push(
      `## 🔴 BAJAR\n${bajar.join("\n")}`
    );
  }

  if (noDisponible.length > 0) {
    sections.push(
      `## ⚪ NO DISPONIBLE\n${noDisponible.join("\n")}`
    );
  }

  const embed =
    new EmbedBuilder()
      .setTitle(
        "📋 P-M-D | Evaluación semanal del Staff"
      )
      .setDescription(
        sections.join("\n\n")
      )
      .setFooter({
        text:
          "💬 Mensajes 50% • 🤝 Alianzas 25% • 🔗 Afiliaciones 25% | 🟢 85%+ Subir • 🟡 46%-84% Mantener • 🔴 0%-45% Bajar",
      })
      .setTimestamp();

  await interaction.reply({
    embeds: [embed],
  });
}

// ==================================================
// /HISTORIAL
// ==================================================

async function handleHistorial(
  interaction
) {
  const code =
    interaction.options
      .getString("codigo")
      ?.trim()
      .toUpperCase();

  if (!code) {
    await interaction.reply({
      content:
        "❌ Debes introducir el código de la semana.",
      ephemeral: true,
    });

    return;
  }

  const history =
    await getWeeklyHistoryByCode(
      interaction.guild.id,
      code
    );

  if (!history) {
    await interaction.reply({
      content:
        "❌ No se encontró ninguna semana con ese código.",
      ephemeral: true,
    });

    return;
  }

  const report =
    history.report_data || {};

  const staff =
    report.staff || [];

  if (staff.length === 0) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(
            "📋 Historial semanal"
          )
          .setDescription(
            `**Semana:** ${history.week}\n\n` +
            "No hay estadísticas registradas para esta semana."
          )
          .addFields({
            name: "🔐 Código",
            value: `\`${history.code}\``,
          })
          .setTimestamp(),
      ],
    });

    return;
  }

  const lines =
    staff.map(
      (member, index) => {
        return (
          `**${index + 1}. <@${member.user_id}>**\n` +
          `🏅 <@&${member.role_id}>\n` +
          `🤝 Alianzas: **${member.alliances}**\n` +
          `🔗 Afiliaciones: **${member.affiliations}**\n` +
          `💬 Mensajes: **${member.messages}**\n` +
          `📊 Progreso: **${
            member.progress === null
              ? "N/A"
              : `${member.progress}%`
          }**\n` +
          `📋 Estado: **${member.status}**`
        );
      }
    );

  let description =
    lines.join("\n\n");

  if (description.length > 4000) {
    description =
      description.substring(0, 4000) +
      "\n\n...";
  }

  const embed =
    new EmbedBuilder()
      .setTitle(
        "📋 Historial semanal"
      )
      .setDescription(
        `**Semana:** ${history.week}\n\n` +
        description
      )
      .addFields({
        name: "🔐 Código",
        value: `\`${history.code}\``,
      })
      .setFooter({
        text:
          "Historial guardado permanentemente.",
      })
      .setTimestamp();

  await interaction.reply({
    embeds: [embed],
  });
}

// ==================================================
// /HELP
// ==================================================

async function handleHelp(
  interaction
) {
  const embed =
    new EmbedBuilder()
      .setTitle(
        "📚 Staff Analytics — Ayuda"
      )
      .setDescription(
        "Guía de comandos disponibles para administrar y consultar el rendimiento del Staff."
      )

      .addFields({
        name: "⚙️ Configuración",
        value:
          "`/config`\n" +
          "Configura los roles, tareas, canales y opciones del sistema de Staff.",
        inline: false,
      })

      .addFields({
        name: "📊 Progreso",
        value:
          "`/progreso [user]`\n" +
          "Consulta el progreso semanal de un miembro.\n\n" +

          "`/progreso-semanal`\n" +
          "Muestra el progreso semanal de todo el Staff.\n\n" +

          "`/progreso-diario`\n" +
          "Muestra el progreso diario de todo el Staff.",
        inline: false,
      })

      .addFields({
        name: "🏆 Rankings",
        value:
          "`/ranking`\n" +
          "Muestra el ranking general del Staff con estadísticas acumuladas.\n\n" +

          "`/top-mensajes`\n" +
          "Muestra el ranking de mensajes.\n\n" +

          "`/top-alianzas`\n" +
          "Muestra el ranking de alianzas.\n\n" +

          "`/top-afiliaciones`\n" +
          "Muestra el ranking de afiliaciones.",
        inline: false,
      })

      .addFields({
        name: "📋 Evaluación P-M-D",
        value:
          "`/p-m-d`\n" +
          "Evalúa el progreso semanal y clasifica al Staff en SUBIR, MANTENER, BAJAR o NO DISPONIBLE.\n\n" +
          "Los porcentajes utilizados son:\n" +
          "💬 Mensajes — 50%\n" +
          "🤝 Alianzas — 25%\n" +
          "🔗 Afiliaciones — 25%",
        inline: false,
      })

      .addFields({
        name: "🗃️ Historiales",
        value:
          "`/historial codigo:<código>`\n" +
          "Consulta un reporte semanal guardado.\n\n" +

          "`/historial-diario codigo:<código>`\n" +
          "Consulta un reporte diario guardado.",
        inline: false,
      })

      .addFields({
        name: "👥 Staff y Administradores",
        value:
          "`/lista-staff`\n" +
          "Muestra todos los miembros que tienen un rol Staff configurado.\n\n" +

          "`/lista-admins`\n" +
          "Muestra todos los miembros que tienen un rol Admin configurado.",
        inline: false,
      })

      .addFields({
        name: "🧪 Reportes",
        value:
          "`/reporte-diario-test`\n" +
          "Genera y envía inmediatamente un reporte diario de prueba.",
        inline: false,
      })

      .addFields({
        name: "ℹ️ Información",
        value:
          "Los datos se almacenan de forma independiente por servidor.\n" +
          "El bot puede utilizarse en múltiples servidores y cada servidor mantiene su propia configuración y estadísticas.",
        inline: false,
      })

      .setFooter({
        text:
          "Staff Analytics • Usa /config para comenzar la configuración.",
      })

      .setTimestamp();

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}

// ==================================================
// INTERACCIONES
// ==================================================

client.on(
  Events.InteractionCreate,
  async (interaction) => {
    try {

      // ============================================
      // CONFIG
      // ============================================

      if (
        interaction.isChatInputCommand() &&
        interaction.commandName === "config"
      ) {
        await handleConfigInteraction(
          interaction
        );

        return;
      }

      // ============================================
      // INTERACCIONES DE CONFIG
      // ============================================

      if (
        interaction.isButton() ||
        interaction.isStringSelectMenu() ||
        interaction.isRoleSelectMenu() ||
        interaction.isChannelSelectMenu() ||
        interaction.isModalSubmit()
      ) {
        const id =
          interaction.customId || "";

        if (
          id.startsWith("config_") ||
          id.startsWith("select_") ||
          id.startsWith("channel_") ||
          id.startsWith("task_") ||
          id.startsWith("tasks_")
        ) {
          await handleConfigInteraction(
            interaction
          );

          return;
        }
      }

      // ============================================
      // SOLO COMANDOS
      // ============================================

      if (
        !interaction.isChatInputCommand()
      ) {
        return;
      }

      // ============================================
      // /HELP
      // ============================================

      if (
        interaction.commandName ===
        "help"
      ) {
        await handleHelp(
          interaction
        );

        return;
      }

      // ============================================
      // /PROGRESO
      // ============================================

      if (
        interaction.commandName ===
        "progreso"
      ) {
        await handleProgreso(
          interaction
        );

        return;
      }

      // ============================================
      // /PROGRESO-SEMANAL
      // ============================================

      if (
        interaction.commandName ===
        "progreso-semanal"
      ) {
        await handleProgresoSemanal(
          interaction
        );

        return;
      }

      // ============================================
      // /PROGRESO-DIARIO
      // ============================================

      if (
        interaction.commandName ===
        "progreso-diario"
      ) {
        await handleProgresoDiario(
          interaction
        );

        return;
      }

      // ============================================
      // /REPORTE-DIARIO-TEST
      // ============================================

      if (
        interaction.commandName ===
        "reporte-diario-test"
      ) {
        await handleDailyReportTest(
          interaction
        );

        return;
      }

      // ============================================
      // /HISTORIAL-DIARIO
      // ============================================

      if (
        interaction.commandName ===
        "historial-diario"
      ) {
        await handleHistorialDiario(
          interaction
        );

        return;
      }

      // ============================================
      // /P-M-D
      // ============================================

      if (
        interaction.commandName ===
        "p-m-d"
      ) {
        await handlePMD(
          interaction
        );

        return;
      }

      // ============================================
      // /HISTORIAL
      // ============================================

      if (
        interaction.commandName ===
        "historial"
      ) {
        await handleHistorial(
          interaction
        );

        return;
      }

      // ============================================
      // TOP ALIANZAS
      // ============================================

      if (
        interaction.commandName ===
        "top-alianzas"
      ) {
        await handleRanking(
          interaction,
          "alliances",
          "🏆 Top Alianzas",
          "🔗"
        );

        return;
      }

      // ============================================
      // TOP AFILIACIONES
      // ============================================

      if (
        interaction.commandName ===
        "top-afiliaciones"
      ) {
        await handleRanking(
          interaction,
          "affiliations",
          "🏆 Top Afiliaciones",
          "🤝"
        );

        return;
      }

      // ============================================
      // TOP MENSAJES
      // ============================================

      if (
        interaction.commandName ===
        "top-mensajes"
      ) {
        await handleRanking(
          interaction,
          "messages",
          "🏆 Top Mensajes",
          "💬"
        );

        return;
      }

      // ============================================
      // LISTA STAFF
      // ============================================

      if (
        interaction.commandName ===
        "lista-staff"
      ) {
        const staffMembers =
          await getStaffMembers(
            interaction.guild
          );

        if (staffMembers.size === 0) {
          await interaction.reply({
            content:
              "❌ No hay miembros con los roles Staff configurados.",
            ephemeral: true,
          });

          return;
        }

        const lines =
          Array.from(
            staffMembers.values()
          ).map(
            (member, index) =>
              `**${index + 1}.** ${member}`
          );

        const embed =
          new EmbedBuilder()
            .setTitle(
              "👮 Lista de Staff"
            )
            .setDescription(
              lines.join("\n")
            )
            .setTimestamp();

        await interaction.reply({
          embeds: [embed],
        });

        return;
      }

      // ============================================
      // LISTA ADMINS
      // ============================================

      if (
        interaction.commandName ===
        "lista-admins"
      ) {
        const adminMembers =
          await getAdminMembers(
            interaction.guild
          );

        if (adminMembers.size === 0) {
          await interaction.reply({
            content:
              "❌ No hay miembros con los roles Admin configurados.",
            ephemeral: true,
          });

          return;
        }

        const lines =
          Array.from(
            adminMembers.values()
          ).map(
            (member, index) =>
              `**${index + 1}.** ${member}`
          );

        const embed =
          new EmbedBuilder()
            .setTitle(
              "👑 Lista de Admins"
            )
            .setDescription(
              lines.join("\n")
            )
            .setTimestamp();

        await interaction.reply({
          embeds: [embed],
        });

        return;
      }

      // ============================================
      // RANKING GENERAL
      // ============================================

      if (
        interaction.commandName ===
        "ranking"
      ) {
        await handleGeneralRanking(
          interaction
        );

        return;
      }

    } catch (error) {

      console.error(
        "❌ Error en interacción:",
        error
      );

      try {

        if (
          interaction.replied ||
          interaction.deferred
        ) {

          await interaction.followUp({
            content:
              "❌ Ocurrió un error al procesar esta acción.",
            ephemeral: true,
          });

        } else {

          await interaction.reply({
            content:
              "❌ Ocurrió un error al procesar esta acción.",
            ephemeral: true,
          });

        }

      } catch (replyError) {

        console.error(
          "❌ No se pudo responder al usuario:",
          replyError
        );

      }
    }
  }
);

// ==================================================
// MENSAJES
// ==================================================

client.on(
  Events.MessageCreate,
  async (message) => {
    try {

      console.log(
        `📨 Mensaje detectado: ${message.author.tag} en #${message.channel.name}`
      );

      await processMessage(message);

    } catch (error) {

      console.error(
        "❌ Error procesando mensaje:",
        error
      );

    }
  }
);

// ==================================================
// COMPROBACIÓN AUTOMÁTICA
// ==================================================

setInterval(
  async () => {

    if (!client.isReady()) {
      return;
    }

    try {

      await checkWeeklyHistory(client);

    } catch (error) {

      console.error(
        "❌ Error en comprobación semanal:",
        error
      );

    }

    try {

      await checkDailyReports(client);

    } catch (error) {

      console.error(
        "❌ Error en comprobación diaria:",
        error
      );

    }

  },
  60 * 1000
);

// ==================================================
// LOGIN
// ==================================================

if (!process.env.DISCORD_TOKEN) {

  console.error(
    "❌ DISCORD_TOKEN no está configurado."
  );

  process.exit(1);
}

client.login(
  process.env.DISCORD_TOKEN
);