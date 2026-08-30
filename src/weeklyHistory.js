const db = require("./database");

// =====================================================
// CONFIGURACIÓN
// =====================================================

const CODE_PREFIX = "WK-";
const CODE_LENGTH = 6;

const CHARACTERS =
  "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";


// =====================================================
// GENERAR CÓDIGO ALEATORIO
// =====================================================

function generateRandomCode() {

  let code = "";

  for (
    let i = 0;
    i < CODE_LENGTH;
    i++
  ) {

    const randomIndex =
      Math.floor(
        Math.random() *
        CHARACTERS.length
      );

    code +=
      CHARACTERS[randomIndex];

  }

  return CODE_PREFIX + code;

}


// =====================================================
// COMPROBAR SI EXISTE UN CÓDIGO
// =====================================================

function codeExists(
  code
) {

  return new Promise(
    (resolve, reject) => {

      db.get(

        `
        SELECT id
        FROM weekly_history
        WHERE code = ?
        `,

        [
          code,
        ],

        (err, row) => {

          if (err) {

            reject(err);
            return;

          }

          resolve(
            !!row
          );

        }

      );

    }
  );

}


// =====================================================
// GENERAR CÓDIGO ÚNICO
// =====================================================

async function generateUniqueCode() {

  let attempts = 0;

  while (
    attempts < 100
  ) {

    const code =
      generateRandomCode();

    const exists =
      await codeExists(
        code
      );

    if (!exists) {

      return code;

    }

    attempts++;

  }

  throw new Error(
    "No se pudo generar un código semanal único."
  );

}


// =====================================================
// GUARDAR HISTORIAL SEMANAL
// =====================================================
//
// reportData puede ser un objeto.
//
// Se convierte automáticamente a JSON
// para guardarlo dentro de SQLite.
//

async function saveWeeklyHistory(
  guildId,
  week,
  reportData
) {

  const code =
    await generateUniqueCode();

  const jsonData =
    JSON.stringify(
      reportData
    );

  const createdAt =
    Math.floor(
      Date.now() / 1000
    );

  return new Promise(
    (resolve, reject) => {

      db.run(

        `
        INSERT INTO weekly_history (
          guild_id,
          week,
          code,
          report_data,
          created_at
        )

        VALUES (?, ?, ?, ?, ?)
        `,

        [
          guildId,
          week,
          code,
          jsonData,
          createdAt,
        ],

        function (err) {

          if (err) {

            // =========================================
            // SEMANA YA GUARDADA
            // =========================================

            if (
              err.message.includes(
                "UNIQUE constraint failed: weekly_history.guild_id, weekly_history.week"
              )
            ) {

              db.get(

                `
                SELECT *
                FROM weekly_history
                WHERE guild_id = ?
                AND week = ?
                `,

                [
                  guildId,
                  week,
                ],

                (
                  selectErr,
                  existing
                ) => {

                  if (selectErr) {

                    reject(
                      selectErr
                    );

                    return;

                  }

                  resolve(
                    existing
                  );

                }

              );

              return;

            }

            reject(err);

            return;

          }

          resolve({

            id:
              this.lastID,

            guild_id:
              guildId,

            week:
              week,

            code:
              code,

            report_data:
              reportData,

            created_at:
              createdAt,

          });

        }

      );

    }
  );

}


// =====================================================
// OBTENER HISTORIAL POR CÓDIGO
// =====================================================

async function getWeeklyHistoryByCode(
  guildId,
  code
) {

  return new Promise(
    (resolve, reject) => {

      db.get(

        `
        SELECT *
        FROM weekly_history
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

          } catch (parseError) {

            console.error(
              "❌ Error leyendo report_data:",
              parseError
            );

          }

          resolve({

            id:
              row.id,

            guild_id:
              row.guild_id,

            week:
              row.week,

            code:
              row.code,

            report_data:
              reportData,

            created_at:
              row.created_at,

          });

        }

      );

    }
  );

}


// =====================================================
// OBTENER HISTORIAL POR SEMANA
// =====================================================

async function getWeeklyHistory(
  guildId,
  week
) {

  return new Promise(
    (resolve, reject) => {

      db.get(

        `
        SELECT *
        FROM weekly_history
        WHERE guild_id = ?
        AND week = ?
        `,

        [
          guildId,
          week,
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

          } catch (parseError) {

            console.error(
              "❌ Error leyendo report_data:",
              parseError
            );

          }

          resolve({

            id:
              row.id,

            guild_id:
              row.guild_id,

            week:
              row.week,

            code:
              row.code,

            report_data:
              reportData,

            created_at:
              row.created_at,

          });

        }

      );

    }
  );

}


// =====================================================
// EXPORTAR
// =====================================================

module.exports = {

  generateRandomCode,

  generateUniqueCode,

  saveWeeklyHistory,

  getWeeklyHistoryByCode,

  getWeeklyHistory,

};