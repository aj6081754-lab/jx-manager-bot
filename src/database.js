const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./staffbot.db", (err) => {

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

      alliance_log_channel_id,
      affiliation_log_channel_id,

      daily_report_channel_id TEXT,
      weekly_report_channel_id TEXT,

      daily_reset_hour INTEGER DEFAULT 0
    )
  `);


  // ===================================================
  // MIGRACIÓN DAILY RESET
  // ===================================================

  db.run(`
    ALTER TABLE guild_config
    ADD COLUMN daily_reset_hour INTEGER DEFAULT 0
  `, (err) => {

    if (
      err &&
      !err.message.includes(
        "duplicate column name"
      )
    ) {

      console.error(
        "⚠️ Error agregando daily_reset_hour:",
        err.message
      );

    }

  });


  // ===================================================
  // ROLES DE STAFF
  // ===================================================
  //
  // Permite configurar múltiples roles como Staff.
  // ===================================================

  db.run(`
    CREATE TABLE IF NOT EXISTS staff_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      guild_id TEXT NOT NULL,
      role_id TEXT NOT NULL,

      UNIQUE(guild_id, role_id)
    )
  `);


  // ===================================================
  // ROLES DE ADMIN
  // ===================================================
  //
  // Permite configurar múltiples roles como Admin.
  // ===================================================

  db.run(`
    CREATE TABLE IF NOT EXISTS admin_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      guild_id TEXT NOT NULL,
      role_id TEXT NOT NULL,

      UNIQUE(guild_id, role_id)
    )
  `);


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
  `);


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
  `);


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
  `);


  // ===================================================
  // HISTORIAL SEMANAL
  // ===================================================
  //
  // Guarda un código único para identificar cada semana.
  //
  // Ejemplo:
  //
  // guild_id: 123456789
  // week: 2026-W35
  // code: WK-7F3K9X
  //
  // Cada servidor puede tener un código diferente
  // para la misma semana.
  // ===================================================

  db.run(`
    CREATE TABLE IF NOT EXISTS weekly_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      guild_id TEXT NOT NULL,
      week TEXT NOT NULL,

      code TEXT NOT NULL,
      created_at INTEGER NOT NULL,

      UNIQUE(guild_id, week),
      UNIQUE(guild_id, code)
    )
  `, (err) => {

    if (err) {

      console.error(
        "❌ Error creando weekly_history:",
        err
      );

    } else {

      console.log(
        "✅ Tabla de historial semanal preparada."
      );

    }

  });


  // ===================================================
  // MIGRAR ROL STAFF ANTIGUO
  // ===================================================
  //
  // Si anteriormente había un staff_role_id,
  // lo pasamos automáticamente a staff_roles.
  //
  // Esto evita perder la configuración existente.
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

});


module.exports = db;