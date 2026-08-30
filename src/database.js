const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./data/staffbot.db", (err) => {
  if (err) {
    console.error(
      "❌ Error al abrir la base de datos:",
      err
    );
  } else {
    console.log(
      "✅ Base de datos conectada."
    );
  }
});
// =====================================================
// CREAR TABLAS
// =====================================================
db.serialize(() => {
  // ===================================================
  // CONFIGURACIÓN DEL SERVIDOR
  // ===================================================
  db.run(`
    CREATE TABLE IF NOT EXISTS guild_config (
      guild_id TEXT PRIMARY KEY,
      staff_role_id TEXT,
      admin_role_id,
      alliance_channel_id TEXT,
      affiliation_channel_id,
      alliance_log_channel_id TEXT,
      affiliation_log_channel_id,
      daily_report_channel_id TEXT,
      weekly_report_channel_id,
      daily_reset_hour INTEGER DEFAULT 0,
      week_end_day INTEGER DEFAULT 0,
      messages_weight INTEGER DEFAULT 50,
      alliances_weight INTEGER DEFAULT 25,
      affiliations_weight INTEGER DEFAULT 25,
      language TEXT DEFAULT 'en'
    )
  `, (err) => {
    if (err) {
      console.error(
        "❌ Error creando guild_config:",
        err.message
      );
    } else {
      console.log(
        "✅ Tabla guild_config preparada."
      );
    }
  });
  // ===================================================
  // MIGRACIÓN DE COLUMNAS DE CONFIGURACIÓN
  // ===================================================
  //
  // IMPORTANTE:
  //
  // CREATE TABLE IF NOT EXISTS NO modifica una tabla
  // que ya existe.
  //
  // Estas migraciones agregan automáticamente las
  // columnas nuevas a bases de datos antiguas.
  //
  // NO se elimina ningún dato existente.
  // ===================================================
  const configColumns = [
    {
      name: "daily_reset_hour",
      definition: "INTEGER DEFAULT 0"
    },
    {
      name: "week_end_day",
      definition: "INTEGER DEFAULT 0"
    },
    {
      name: "messages_weight",
      definition: "INTEGER DEFAULT 50"
    },
    {
      name: "alliances_weight",
      definition: "INTEGER DEFAULT 25"
    },
    {
      name: "affiliations_weight",
      definition: "INTEGER DEFAULT 25"
    },
    {
      name: "language",
      definition: "TEXT DEFAULT 'en'"
    }
  ];
  for (const column of configColumns) {
    db.run(`
      ALTER TABLE guild_config
      ADD COLUMN ${column.name} ${column.definition}
    `, (err) => {
      if (!err) {
        console.log(
          `✅ Columna ${column.name} agregada.`
        );
        return;
      }
      // La columna ya existe.
      if (
        err.message.includes(
          "duplicate column name"
        )
      ) {
        return;
      }
      console.error(
        `⚠️ Error agregando ${column.name}:`,
        err.message
      );
    });
  }
  // ===================================================
  // ROLES DE STAFF
  // ===================================================
  db.run(`
    CREATE TABLE IF NOT EXISTS staff_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      UNIQUE(guild_id, role_id)
    )
  `, (err) => {
    if (err) {
      console.error(
        "❌ Error creando staff_roles:",
        err.message
      );
    }
  });
  // ===================================================
  // ROLES DE ADMIN
  // ===================================================
  db.run(`
    CREATE TABLE IF NOT EXISTS admin_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      UNIQUE(guild_id, role_id)
    )
  `, (err) => {
    if (err) {
      console.error(
        "❌ Error creando admin_roles:",
        err.message
      );
    }
  });
  // ===================================================
  // ESTADÍSTICAS SEMANALES
  // ===================================================
  db.run(`
    CREATE TABLE IF NOT EXISTS weekly_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      week TEXT NOT NULL,
      messages INTEGER DEFAULT 0,
      alliances INTEGER DEFAULT 0,
      affiliations INTEGER DEFAULT 0,
      UNIQUE(guild_id, user_id, week)
    )
  `, (err) => {
    if (err) {
      console.error(
        "❌ Error creando weekly_stats:",
        err.message
      );
    }
  });
  // ===================================================
  // ESTADÍSTICAS DIARIAS
  // ===================================================
  db.run(`
    CREATE TABLE IF NOT EXISTS daily_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      day TEXT NOT NULL,
      messages INTEGER DEFAULT 0,
      alliances INTEGER DEFAULT 0,
      affiliations INTEGER DEFAULT 0,
      UNIQUE(guild_id, user_id, day)
    )
  `, (err) => {
    if (err) {
      console.error(
        "❌ Error creando daily_stats:",
        err.message
      );
    }
  });
  // ===================================================
  // TAREAS DE CADA ROL
  // ===================================================
  db.run(`
    CREATE TABLE IF NOT EXISTS role_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      messages_required INTEGER DEFAULT 0,
      alliances_required INTEGER DEFAULT 0,
      affiliations_required INTEGER DEFAULT 0,
      UNIQUE(guild_id, role_id)
    )
  `, (err) => {
    if (err) {
      console.error(
        "❌ Error creando role_tasks:",
        err.message
      );
    }
  });
  // ===================================================
  // HISTORIAL SEMANAL
  // ===================================================
  db.run(`
    CREATE TABLE IF NOT EXISTS weekly_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      week TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      report_data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(guild_id, week)
    )
  `, (err) => {
    if (err) {
      console.error(
        "❌ Error creando weekly_history:",
        err.message
      );
    } else {
      console.log(
        "✅ Tabla weekly_history preparada."
      );
    }
  });
  // ===================================================
  // MIGRAR ROL STAFF ANTIGUO
  // ===================================================
  db.run(`
    INSERT OR IGNORE INTO staff_roles (
      guild_id,
      role_id
    )
    SELECT
      guild_id,
      staff_role_id
    FROM guild_config
    WHERE
      staff_role_id IS NOT NULL
      AND staff_role_id != ''
  `, (err) => {
    if (err) {
      console.error(
        "⚠️ Error migrando roles Staff:",
        err.message
      );
    } else {
      console.log(
        "✅ Migración de roles Staff completada."
      );
    }
  });
  // ===================================================
  // MIGRAR ROL ADMIN ANTIGUO
  // ===================================================
  db.run(`
    INSERT OR IGNORE INTO admin_roles (
      guild_id,
      role_id
    )
    SELECT
      guild_id,
      admin_role_id
    FROM guild_config
    WHERE
      admin_role_id IS NOT NULL
      AND admin_role_id != ''
  `, (err) => {
    if (err) {
      console.error(
        "⚠️ Error migrando roles Admin:",
        err.message
      );
    } else {
      console.log(
        "✅ Migración de roles Admin completada."
      );
    }
  });
  // ===================================================
  // CORREGIR VALORES NULL
  // ===================================================
  db.run(`
    UPDATE guild_config
    SET daily_reset_hour = 0
    WHERE daily_reset_hour IS NULL
  `);
  db.run(`
    UPDATE guild_config
    SET week_end_day = 0
    WHERE week_end_day IS NULL
  `);
  db.run(`
    UPDATE guild_config
    SET messages_weight = 50
    WHERE messages_weight IS NULL
  `);
  db.run(`
    UPDATE guild_config
    SET alliances_weight = 25
    WHERE alliances_weight IS NULL
  `);
  db.run(`
    UPDATE guild_config
    SET affiliations_weight = 25
    WHERE affiliations_weight IS NULL
  `);
  // ===================================================
  // IDIOMA PREDETERMINADO
  // ===================================================
  //
  // English = "en"
  //
  // Si un servidor antiguo no tiene idioma configurado,
  // se establece automáticamente English.
  // ===================================================
  db.run(`
    UPDATE guild_config
    SET language = 'en'
    WHERE language IS NULL
      OR language = ''
  `);
});
// =====================================================
// EXPORTAR DATABASE
// =====================================================
module.exports = db;