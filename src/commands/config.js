const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const db = require("../database");

// =====================================================
// /CONFIG
// =====================================================

const command = new SlashCommandBuilder()
  .setName("config")
  .setDescription("Configura el sistema de Staff")
  .setDefaultMemberPermissions(
    PermissionFlagsBits.Administrator
  );

// =====================================================
// CONFIGURACIÓN POR DEFECTO
// =====================================================

const DEFAULT_WEIGHTS = {
  messages: 50,
  alliances: 25,
  affiliations: 25,
};

const DAYS = [
  {
    value: "0",
    label: "Domingo",
    emoji: "🟥",
  },
  {
    value: "1",
    label: "Lunes",
    emoji: "🟧",
  },
  {
    value: "2",
    label: "Martes",
    emoji: "🟨",
  },
  {
    value: "3",
    label: "Miércoles",
    emoji: "🟩",
  },
  {
    value: "4",
    label: "Jueves",
    emoji: "🟦",
  },
  {
    value: "5",
    label: "Viernes",
    emoji: "🟪",
  },
  {
    value: "6",
    label: "Sábado",
    emoji: "⬜",
  },
];

// =====================================================
// ASEGURAR COLUMNAS NUEVAS
// =====================================================
//
// Estas columnas permiten utilizar el nuevo sistema
// sin tener que modificar manualmente database.js.
//
// Valores por defecto:
//   week_end_day = 0
//   messages_weight = 50
//   alliances_weight = 25
//   affiliations_weight = 25
// =====================================================


// =====================================================
// NAVEGACIÓN
// =====================================================

function navigationButtons(backId = null) {
  const buttons = [];

  if (backId) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(backId)
        .setLabel("↩️ Volver")
        .setStyle(ButtonStyle.Secondary)
    );
  }

  buttons.push(
    new ButtonBuilder()
      .setCustomId("config_home")
      .setLabel("🏠 Menú principal")
      .setStyle(ButtonStyle.Primary)
  );

  return new ActionRowBuilder().addComponents(
    buttons
  );
}

// =====================================================
// OBTENER CONFIGURACIÓN
// =====================================================

function getGuildConfig(guildId) {
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

          resolve(row || null);
        }
      );
    }
  );
}

// =====================================================
// CREAR CONFIGURACIÓN SI NO EXISTE
// =====================================================

function ensureGuildConfig(guildId) {
  return new Promise(
    (resolve, reject) => {
      db.run(
        `
        INSERT OR IGNORE INTO guild_config (
          guild_id,
          daily_reset_hour,
          week_end_day,
          messages_weight,
          alliances_weight,
          affiliations_weight
        )
        VALUES (?, 0, 0, 50, 25, 25)
        `,
        [guildId],
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
// MENÚ PRINCIPAL
// =====================================================

async function showMainMenu(
  interaction,
  update = false
) {
  try {
    await ensureGuildConfig(
      interaction.guildId
    );

    const config =
      await getGuildConfig(
        interaction.guildId
      );

    const weekEndDay =
      Number.isInteger(
        config?.week_end_day
      )
        ? config.week_end_day
        : 0;

    const day =
      DAYS.find(
        (item) =>
          Number(item.value) ===
          weekEndDay
      );

    const messagesWeight =
      config?.messages_weight ??
      DEFAULT_WEIGHTS.messages;

    const alliancesWeight =
      config?.alliances_weight ??
      DEFAULT_WEIGHTS.alliances;

    const affiliationsWeight =
      config?.affiliations_weight ??
      DEFAULT_WEIGHTS.affiliations;

    const embed =
      new EmbedBuilder()
        .setTitle(
          "⚙️ Configuración de Staff"
        )
        .setDescription(
          "Aquí puedes configurar todas las opciones del sistema de Staff.\n\n" +

          `👥 **Roles**\n` +
          `Configura qué roles pertenecen al Staff y cuáles pertenecen a los Admin.\n\n` +

          `📺 **Canales**\n` +
          `Configura los canales utilizados para alianzas, afiliaciones, logs y reportes.\n\n` +

          `📋 **Tareas**\n` +
          `Configura las cantidades semanales de tareas para cada rol.\n\n` +

          `📅 **Fin de semana**\n` +
          `Configura qué día termina la semana de estadísticas.\n` +

          `Actualmente: **${day?.label || "Domingo"}**\n\n` +

          `🕐 **Hora de reinicio**\n` +
          `Configura a qué hora comienza el nuevo día para las estadísticas.\n\n` +

          `⚖️ **Peso de tareas**\n` +
          `Configura cuánto vale cada tipo de tarea en el porcentaje final.\n\n` +
          `💬 Mensajes: **${messagesWeight}%**\n` +
          `🤝 Alianzas: **${alliancesWeight}%**\n` +
          `🔗 Afiliaciones: **${affiliationsWeight}%**\n\n` +

          `**Total:** ${
            Number(messagesWeight) +
            Number(alliancesWeight) +
            Number(affiliationsWeight)
          }%`
        );

    const menu =
      new StringSelectMenuBuilder()
        .setCustomId(
          "config_menu"
        )
        .setPlaceholder(
          "Selecciona una categoría"
        )
        .addOptions(
          {
            label: "Roles",
            description:
              "Configurar los roles de Staff y Admin",
            value: "roles",
            emoji: "👥",
          },
          {
            label: "Canales",
            description:
              "Configurar todos los canales del sistema",
            value: "channels",
            emoji: "📺",
          },
          {
            label: "Tareas",
            description:
              "Configurar las tareas semanales de cada rol",
            value: "tasks",
            emoji: "📋",
          },
          {
            label: "Fin de semana",
            description:
              "Elegir qué día termina la semana",
            value: "week_end",
            emoji: "📅",
          },
          {
            label: "Hora de reinicio",
            description:
              "Configurar cuándo comienza el nuevo día",
            value: "reset_time",
            emoji: "🕐",
          },
          {
            label: "Peso de tareas",
            description:
              "Cambiar el porcentaje de cada tarea",
            value: "task_weights",
            emoji: "⚖️",
          }
        );

    const components = [
      new ActionRowBuilder().addComponents(
        menu
      ),
    ];

    if (update) {
      await interaction.update({
        embeds: [embed],
        components,
      });
    } else {
      await interaction.reply({
        embeds: [embed],
        components,
        ephemeral: true,
      });
    }
  } catch (error) {
    console.error(
      "❌ Error mostrando menú principal:",
      error
    );

    if (
      !interaction.replied &&
      !interaction.deferred
    ) {
      await interaction.reply({
        content:
          "❌ No se pudo cargar la configuración.",
        ephemeral: true,
      });
    }
  }
}

// =====================================================
// MENÚ DE ROLES
// =====================================================

async function showRolesMenu(interaction) {
  const embed =
    new EmbedBuilder()
      .setTitle(
        "👥 Configuración de roles"
      )
      .setDescription(
        "Configura los roles que pertenecerán al sistema.\n\n" +
        "👮 **Roles de Staff:** selecciona todos los roles que serán considerados Staff.\n\n" +
        "👑 **Roles de Admin:** selecciona todos los roles que serán considerados Admin."
      );

  const menu =
    new StringSelectMenuBuilder()
      .setCustomId(
        "config_roles_menu"
      )
      .setPlaceholder(
        "Selecciona una opción"
      )
      .addOptions(
        {
          label: "Roles de Staff",
          description:
            "Seleccionar todos los roles que serán Staff",
          value: "staff_roles",
          emoji: "👮",
        },
        {
          label: "Roles de Admin",
          description:
            "Seleccionar todos los roles que serán Admin",
          value: "admin_roles",
          emoji: "👑",
        }
      );

  await interaction.update({
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        menu
      ),
      navigationButtons(),
    ],
  });
}

// =====================================================
// SELECTOR MÚLTIPLE DE ROLES
// =====================================================

async function showRoleSelector(
  interaction
) {
  const value =
    interaction.values[0];

  const isStaff =
    value === "staff_roles";

  const menu =
    new RoleSelectMenuBuilder()
      .setCustomId(
        `select_${value}`
      )
      .setPlaceholder(
        isStaff
          ? "Selecciona los roles de Staff"
          : "Selecciona los roles de Admin"
      )
      .setMinValues(1)
      .setMaxValues(25);

  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setTitle(
          isStaff
            ? "👮 Roles de Staff"
            : "👑 Roles de Admin"
        )
        .setDescription(
          isStaff
            ? "Selecciona todos los roles que quieres considerar como Staff."
            : "Selecciona todos los roles que quieres considerar como Admin."
        ),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        menu
      ),
      navigationButtons(
        "config_roles_menu"
      ),
    ],
  });
}

// =====================================================
// GUARDAR MÚLTIPLES ROLES
// =====================================================

async function saveMultipleRoles(
  interaction,
  type
) {
  const roleIds =
    interaction.values || [];

  if (roleIds.length === 0) {
    await interaction.reply({
      content:
        "❌ Debes seleccionar al menos un rol.",
      ephemeral: true,
    });

    return;
  }

  const table =
    type === "staff_roles"
      ? "staff_roles"
      : "admin_roles";

  const roleName =
    type === "staff_roles"
      ? "Staff"
      : "Admin";

  db.run(
    `
    DELETE FROM ${table}
    WHERE guild_id = ?
    `,
    [interaction.guildId],
    (deleteErr) => {
      if (deleteErr) {
        console.error(
          "❌ Error eliminando roles:",
          deleteErr
        );

        return interaction.update({
          embeds: [
            new EmbedBuilder()
              .setTitle("❌ Error")
              .setDescription(
                "No se pudieron actualizar los roles."
              ),
          ],
          components: [
            navigationButtons(
              "config_roles_menu"
            ),
          ],
        });
      }

      const placeholders =
        roleIds
          .map(
            () => "(?, ?)"
          )
          .join(", ");

      const params = [];

      for (const roleId of roleIds) {
        params.push(
          interaction.guildId,
          roleId
        );
      }

      db.run(
        `
        INSERT INTO ${table} (
          guild_id,
          role_id
        )
        VALUES ${placeholders}
        `,
        params,
        async (insertErr) => {
          if (insertErr) {
            console.error(
              "❌ Error guardando roles:",
              insertErr
            );

            await interaction.update({
              embeds: [
                new EmbedBuilder()
                  .setTitle(
                    "❌ Error"
                  )
                  .setDescription(
                    "No se pudieron guardar los roles seleccionados."
                  ),
              ],
              components: [
                navigationButtons(
                  "config_roles_menu"
                ),
              ],
            });

            return;
          }

          const mentions =
            roleIds
              .map(
                (id) =>
                  `<@&${id}>`
              )
              .join("\n");

          await interaction.update({
            embeds: [
              new EmbedBuilder()
                .setTitle(
                  "✅ Roles configurados"
                )
                .setDescription(
                  `Se configuraron correctamente los **roles de ${roleName}**.\n\n` +
                  mentions
                ),
            ],
            components: [
              navigationButtons(
                "config_roles_menu"
              ),
            ],
          });
        }
      );
    }
  );
}

// =====================================================
// MENÚ DE CANALES
// =====================================================

async function showChannelsMenu(
  interaction
) {
  const embed =
    new EmbedBuilder()
      .setTitle(
        "📺 Configuración de canales"
      )
      .setDescription(
        "Configura los canales utilizados por el sistema."
      );

  const menu =
    new StringSelectMenuBuilder()
      .setCustomId(
        "config_channels_menu"
      )
      .setPlaceholder(
        "Selecciona una opción"
      )
      .addOptions(
        {
          label:
            "Canal de alianzas",
          description:
            "Canal donde se detectarán links de alianzas",
          value:
            "alliance_channel",
          emoji: "🤝",
        },
        {
          label:
            "Canal de afiliaciones",
          description:
            "Canal donde se detectarán links de afiliaciones",
          value:
            "affiliation_channel",
          emoji: "🔗",
        },
        {
          label:
            "Logs de alianzas",
          description:
            "Canal donde se enviarán los logs de alianzas",
          value:
            "alliance_log_channel",
          emoji: "📋",
        },
        {
          label:
            "Logs de afiliaciones",
          description:
            "Canal donde se enviarán los logs de afiliaciones",
          value:
            "affiliation_log_channel",
          emoji: "📋",
        },
        {
          label:
            "Reportes diarios",
          description:
            "Canal donde se enviarán los reportes diarios",
          value:
            "daily_report_channel",
          emoji: "📊",
        },
        {
          label:
            "Reportes semanales",
          description:
            "Canal donde se enviarán los reportes semanales",
          value:
            "weekly_report_channel",
          emoji: "📈",
        }
      );

  await interaction.update({
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        menu
      ),
      navigationButtons(),
    ],
  });
}

// =====================================================
// SELECTOR DE CANAL
// =====================================================

async function showChannelSelector(
  interaction
) {
  const value =
    interaction.values[0];

  const menu =
    new ChannelSelectMenuBuilder()
      .setCustomId(
        `channel_${value}`
      )
      .setPlaceholder(
        "Selecciona un canal"
      )
      .setChannelTypes(
        ChannelType.GuildText
      )
      .setMinValues(1)
      .setMaxValues(1);

  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setTitle(
          "📺 Seleccionar canal"
        )
        .setDescription(
          "Selecciona el canal que quieres utilizar."
        ),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        menu
      ),
      navigationButtons(
        "config_channels_menu"
      ),
    ],
  });
}

// =====================================================
// OBTENER ROLES STAFF
// =====================================================

function getConfiguredStaffRoles(
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

          resolve(rows || []);
        }
      );
    }
  );
}

// =====================================================
// OBTENER ROLES ADMIN
// =====================================================

function getConfiguredAdminRoles(
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

          resolve(rows || []);
        }
      );
    }
  );
}

// =====================================================
// OBTENER ROLES PARA TAREAS
// =====================================================

async function getConfiguredRolesForTasks(
  guildId,
  type
) {
  if (type === "admin") {
    return getConfiguredAdminRoles(
      guildId
    );
  }

  return getConfiguredStaffRoles(
    guildId
  );
}

// =====================================================
// MENÚ PRINCIPAL DE TAREAS
// =====================================================

async function showTasksMenu(
  interaction
) {
  const embed =
    new EmbedBuilder()
      .setTitle(
        "📋 Configuración de tareas"
      )
      .setDescription(
        "Selecciona qué tipo de roles quieres configurar.\n\n" +
        "👮 **Tareas de Staff**\n" +
        "Configura las cantidades semanales para los roles Staff.\n\n" +
        "👑 **Tareas de Admin**\n" +
        "Configura las cantidades semanales para los roles Admin."
      );

  const menu =
    new StringSelectMenuBuilder()
      .setCustomId(
        "config_tasks_type"
      )
      .setPlaceholder(
        "Selecciona un tipo de rol"
      )
      .addOptions(
        {
          label:
            "Tareas de Staff",
          description:
            "Configurar tareas para los roles Staff",
          value: "staff",
          emoji: "👮",
        },
        {
          label:
            "Tareas de Admin",
          description:
            "Configurar tareas para los roles Admin",
          value: "admin",
          emoji: "👑",
        }
      );

  await interaction.update({
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        menu
      ),
      navigationButtons(),
    ],
  });
}

// =====================================================
// MOSTRAR ROLES PARA TAREAS
// =====================================================

async function showTaskRoleSelector(
  interaction
) {
  const type =
    interaction.values[0];

  const isAdmin =
    type === "admin";

  const roles =
    await getConfiguredRolesForTasks(
      interaction.guildId,
      type
    );

  const availableRoles =
    roles
      .map((row) => {
        return interaction.guild.roles.cache.get(
          row.role_id
        );
      })
      .filter(Boolean);

  if (
    availableRoles.length === 0
  ) {
    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle(
            isAdmin
              ? "👑 Tareas de Admin"
              : "👮 Tareas de Staff"
          )
          .setDescription(
            isAdmin
              ? "❌ No hay roles de Admin configurados.\n\nPrimero configura los roles de Admin."
              : "❌ No hay roles de Staff configurados.\n\nPrimero configura los roles de Staff."
          ),
      ],
      components: [
        navigationButtons(
          "config_tasks_type"
        ),
      ],
    });

    return;
  }

  const options =
    availableRoles
      .slice(0, 25)
      .map((role) => ({
        label:
          role.name.substring(
            0,
            100
          ),
        description:
          `Configurar tareas de ${role.name}`.substring(
            0,
            100
          ),
        value:
          role.id,
        emoji:
          isAdmin
            ? "👑"
            : "👮",
      }));

  const menu =
    new StringSelectMenuBuilder()
      .setCustomId(
        `tasks_select_role_${type}`
      )
      .setPlaceholder(
        isAdmin
          ? "Selecciona un rol Admin"
          : "Selecciona un rol Staff"
      )
      .addOptions(options);

  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setTitle(
          isAdmin
            ? "👑 Tareas de Admin"
            : "👮 Tareas de Staff"
        )
        .setDescription(
          "Selecciona un rol para configurar sus tareas."
        ),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        menu
      ),
      navigationButtons(
        "config_tasks_type"
      ),
    ],
  });
}

// =====================================================
// MOSTRAR TAREAS DEL ROL
// =====================================================

async function showRoleTasks(
  interaction,
  type
) {
  try {
    const roleId =
      interaction.values?.[0];

    if (!roleId) {
      throw new Error(
        "No se recibió ningún ID de rol."
      );
    }

    const isAdmin =
      type === "admin";

    const table =
      isAdmin
        ? "admin_roles"
        : "staff_roles";

    const configuredRole =
      await new Promise(
        (resolve, reject) => {
          db.get(
            `
            SELECT role_id
            FROM ${table}
            WHERE guild_id = ?
            AND role_id = ?
            `,
            [
              interaction.guildId,
              roleId,
            ],
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

    if (!configuredRole) {
      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle(
              "❌ Rol no válido"
            )
            .setDescription(
              isAdmin
                ? "Ese rol no está configurado como Admin."
                : "Ese rol no está configurado como Staff."
            ),
        ],
        components: [
          navigationButtons(
            `tasks_select_role_${type}`
          ),
        ],
      });

      return;
    }

    const role =
      interaction.guild.roles.cache.get(
        roleId
      );

    if (!role) {
      throw new Error(
        `No se encontró el rol ${roleId}.`
      );
    }

    const taskData =
      await new Promise(
        (resolve, reject) => {
          db.get(
            `
            SELECT *
            FROM role_tasks
            WHERE guild_id = ?
            AND role_id = ?
            `,
            [
              interaction.guildId,
              roleId,
            ],
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

    const messages =
      taskData?.messages_required ||
      0;

    const alliances =
      taskData?.alliances_required ||
      0;

    const affiliations =
      taskData?.affiliations_required ||
      0;

    const config =
      await getGuildConfig(
        interaction.guildId
      );

    const messagesWeight =
      config?.messages_weight ??
      DEFAULT_WEIGHTS.messages;

    const alliancesWeight =
      config?.alliances_weight ??
      DEFAULT_WEIGHTS.alliances;

    const affiliationsWeight =
      config?.affiliations_weight ??
      DEFAULT_WEIGHTS.affiliations;

    const embed =
      new EmbedBuilder()
        .setTitle(
          `${isAdmin ? "👑" : "👮"} Tareas — ${role.name}`
        )
        .setDescription(
          `Configuración de tareas para <@&${role.id}>.\n\n` +

          `**Tipo:** ${
            isAdmin
              ? "👑 Admin"
              : "👮 Staff"
          }\n\n` +

          `💬 **Mensajes semanales:** ${
            messages > 0
              ? messages
              : "No configurado"
          }\n\n` +

          `🤝 **Alianzas semanales:** ${
            alliances > 0
              ? alliances
              : "No configurado"
          }\n\n` +

          `🔗 **Afiliaciones semanales:** ${
            affiliations > 0
              ? affiliations
              : "No configurado"
          }\n\n` +

          `**Peso en el porcentaje final:**\n` +
          `💬 Mensajes — **${messagesWeight}%**\n` +
          `🤝 Alianzas — **${alliancesWeight}%**\n` +
          `🔗 Afiliaciones — **${affiliationsWeight}%**`
        );

    const taskButtons =
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(
            `task_messages_${role.id}`
          )
          .setLabel(
            "💬 Mensajes"
          )
          .setStyle(
            ButtonStyle.Secondary
          ),

        new ButtonBuilder()
          .setCustomId(
            `task_alliances_${role.id}`
          )
          .setLabel(
            "🤝 Alianzas"
          )
          .setStyle(
            ButtonStyle.Secondary
          ),

        new ButtonBuilder()
          .setCustomId(
            `task_affiliations_${role.id}`
          )
          .setLabel(
            "🔗 Afiliaciones"
          )
          .setStyle(
            ButtonStyle.Secondary
          )
      );

    const navigation =
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(
            `tasks_select_role_${type}`
          )
          .setLabel(
            "↩️ Volver"
          )
          .setStyle(
            ButtonStyle.Secondary
          ),

        new ButtonBuilder()
          .setCustomId(
            "config_home"
          )
          .setLabel(
            "🏠 Menú principal"
          )
          .setStyle(
            ButtonStyle.Primary
          )
      );

    await interaction.update({
      embeds: [embed],
      components: [
        taskButtons,
        navigation,
      ],
    });
  } catch (error) {
    console.error(
      "❌ Error mostrando tareas del rol:",
      error
    );

    if (
      !interaction.replied &&
      !interaction.deferred
    ) {
      await interaction.reply({
        content:
          "❌ No se pudo cargar el rol seleccionado.",
        ephemeral: true,
      });
    }
  }
}

// =====================================================
// MODAL PARA CONFIGURAR TAREA
// =====================================================

async function showTaskModal(
  interaction,
  type,
  roleId
) {
  const taskNames = {
    messages: {
      label:
        "Mensajes semanales",
      title:
        "💬 Configurar mensajes",
    },

    alliances: {
      label:
        "Alianzas semanales",
      title:
        "🤝 Configurar alianzas",
    },

    affiliations: {
      label:
        "Afiliaciones semanales",
      title:
        "🔗 Configurar afiliaciones",
    },
  };

  const data =
    taskNames[type];

  if (!data) {
    return;
  }

  const modal =
    new ModalBuilder()
      .setCustomId(
        `task_modal_${type}_${roleId}_${interaction.id}`
      )
      .setTitle(
        data.title
      );

  const input =
    new TextInputBuilder()
      .setCustomId(
        "task_amount"
      )
      .setLabel(
        data.label
      )
      .setPlaceholder(
        "Ejemplo: 350"
      )
      .setStyle(
        TextInputStyle.Short
      )
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(6);

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      input
    )
  );

  await interaction.showModal(
    modal
  );
}

// =====================================================
// GUARDAR TAREA
// =====================================================

async function saveTask(
  interaction,
  type,
  roleId
) {
  const amountText =
    interaction.fields.getTextInputValue(
      "task_amount"
    );

  const amount =
    Number(amountText);

  if (
    !Number.isInteger(amount) ||
    amount < 0
  ) {
    await interaction.reply({
      content:
        "❌ Debes introducir un número entero válido mayor o igual a 0.",
      ephemeral: true,
    });

    return;
  }

  const columns = {
    messages:
      "messages_required",

    alliances:
      "alliances_required",

    affiliations:
      "affiliations_required",
  };

  const column =
    columns[type];

  if (!column) {
    await interaction.reply({
      content:
        "❌ Tipo de tarea no válido.",
      ephemeral: true,
    });

    return;
  }

  const roleConfig =
    await new Promise(
      (resolve, reject) => {
        db.get(
          `
          SELECT
            CASE
              WHEN EXISTS (
                SELECT 1
                FROM staff_roles
                WHERE guild_id = ?
                AND role_id = ?
              )
              THEN 'staff'

              WHEN EXISTS (
                SELECT 1
                FROM admin_roles
                WHERE guild_id = ?
                AND role_id = ?
              )
              THEN 'admin'

              ELSE NULL
            END AS role_type
          `,
          [
            interaction.guildId,
            roleId,
            interaction.guildId,
            roleId,
          ],
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

  if (!roleConfig?.role_type) {
    await interaction.reply({
      content:
        "❌ Ese rol ya no está configurado como Staff o Admin.",
      ephemeral: true,
    });

    return;
  }

  db.run(
    `
    INSERT INTO role_tasks (
      guild_id,
      role_id,
      messages_required,
      alliances_required,
      affiliations_required
    )
    VALUES (?, ?, 0, 0, 0)

    ON CONFLICT(guild_id, role_id)
    DO NOTHING
    `,
    [
      interaction.guildId,
      roleId,
    ],
    (insertErr) => {
      if (insertErr) {
        console.error(
          "❌ Error creando tareas:",
          insertErr
        );

        return interaction.reply({
          content:
            "❌ No se pudo crear la configuración de tareas.",
          ephemeral: true,
        });
      }

      db.run(
        `
        UPDATE role_tasks
        SET ${column} = ?
        WHERE guild_id = ?
        AND role_id = ?
        `,
        [
          amount,
          interaction.guildId,
          roleId,
        ],
        async (updateErr) => {
          if (updateErr) {
            console.error(
              "❌ Error guardando tarea:",
              updateErr
            );

            await interaction.reply({
              content:
                "❌ No se pudo guardar la tarea.",
              ephemeral: true,
            });

            return;
          }

          const taskName =
            type === "messages"
              ? "💬 Mensajes"
              : type === "alliances"
              ? "🤝 Alianzas"
              : "🔗 Afiliaciones";

          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle(
                  "✅ Tarea configurada"
                )
                .setDescription(
                  `Se configuró correctamente la tarea de **${taskName}**.\n\n` +
                  `**Rol:** <@&${roleId}>\n` +
                  `**Cantidad semanal:** **${amount}**\n\n` +
                  `Tipo de rol: ${
                    roleConfig.role_type ===
                    "admin"
                      ? "👑 Admin"
                      : "👮 Staff"
                  }`
                ),
            ],
            ephemeral: true,
          });
        }
      );
    }
  );
}

// =====================================================
// FORMATO 12 HORAS
// =====================================================

function format12Hour(hour) {
  const suffix =
    hour >= 12
      ? "PM"
      : "AM";

  let displayHour =
    hour % 12;

  if (displayHour === 0) {
    displayHour = 12;
  }

  return `${displayHour}:00 ${suffix}`;
}

// =====================================================
// TIMESTAMP MST
// =====================================================

function getMSTTimestamp(hour) {
  const now =
    new Date();

  const mstNow =
    new Date(
      now.getTime() -
        7 *
          60 *
          60 *
          1000
    );

  const year =
    mstNow.getUTCFullYear();

  const month =
    mstNow.getUTCMonth();

  const day =
    mstNow.getUTCDate();

  const timestamp =
    Date.UTC(
      year,
      month,
      day,
      hour + 7,
      0,
      0
    );

  return Math.floor(
    timestamp / 1000
  );
}

// =====================================================
// MENÚ DE HORA
// =====================================================

async function showResetTimeMenu(
  interaction
) {
  const options = [];

  for (
    let hour = 0;
    hour < 24;
    hour++
  ) {
    const formatted =
      format12Hour(hour);

    const timestamp =
      getMSTTimestamp(hour);

    options.push({
      label:
        formatted,

      description:
        `MST (UTC-7) • <t:${timestamp}:t>`,

      value:
        String(hour),

      emoji:
        "🕐",
    });
  }

  const menu =
    new StringSelectMenuBuilder()
      .setCustomId(
        "config_reset_time"
      )
      .setPlaceholder(
        "Selecciona la hora de reinicio"
      )
      .addOptions(
        options
      );

  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setTitle(
          "🕐 Hora de reinicio diario"
        )
        .setDescription(
          "Selecciona la hora en la que comenzará el nuevo día para las estadísticas diarias.\n\n" +
          "**Zona utilizada:** Mountain Standard Time (MST)\n" +
          "**UTC:** UTC−7\n\n" +
          "El timestamp se adapta automáticamente a la zona horaria de cada persona que vea el mensaje."
        ),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        menu
      ),
      navigationButtons(),
    ],
  });
}

// =====================================================
// GUARDAR HORA
// =====================================================

async function saveResetTime(
  interaction
) {
  const hour =
    Number(
      interaction.values[0]
    );

  if (
    !Number.isInteger(hour) ||
    hour < 0 ||
    hour > 23
  ) {
    await interaction.reply({
      content:
        "❌ La hora seleccionada no es válida.",
      ephemeral: true,
    });

    return;
  }

  await ensureGuildConfig(
    interaction.guildId
  );

  db.run(
    `
    UPDATE guild_config
    SET daily_reset_hour = ?
    WHERE guild_id = ?
    `,
    [
      hour,
      interaction.guildId,
    ],
    async (err) => {
      if (err) {
        console.error(
          "❌ Error guardando hora:",
          err
        );

        await interaction.update({
          embeds: [
            new EmbedBuilder()
              .setTitle(
                "❌ Error"
              )
              .setDescription(
                "No se pudo guardar la hora de reinicio."
              ),
          ],
          components: [
            navigationButtons(),
          ],
        });

        return;
      }

      const formatted =
        format12Hour(hour);

      const timestamp =
        getMSTTimestamp(hour);

      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle(
              "✅ Hora de reinicio configurada"
            )
            .setDescription(
              `El nuevo día comenzará a las **${formatted} MST**.\n\n` +
              `Hora para cada usuario: <t:${timestamp}:F>\n\n` +
              "Esta configuración se guardó correctamente."
            ),
        ],
        components: [
          navigationButtons(),
        ],
      });
    }
  );
}

// =====================================================
// MENÚ DE FIN DE SEMANA
// =====================================================

async function showWeekEndMenu(
  interaction
) {
  await ensureGuildConfig(
    interaction.guildId
  );

  const config =
    await getGuildConfig(
      interaction.guildId
    );

  const currentDay =
    Number.isInteger(
      config?.week_end_day
    )
      ? config.week_end_day
      : 0;

  const current =
    DAYS.find(
      (day) =>
        Number(day.value) ===
        currentDay
    );

  const menu =
    new StringSelectMenuBuilder()
      .setCustomId(
        "config_week_end"
      )
      .setPlaceholder(
        "Selecciona el día"
      )
      .addOptions(
        DAYS.map((day) => ({
          label:
            day.label,
          description:
            `La semana terminará el ${day.label}`,
          value:
            day.value,
          emoji:
            day.emoji,
        }))
      );

  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setTitle(
          "📅 Fin de semana"
        )
        .setDescription(
          `Selecciona qué día quieres que termine la semana de estadísticas.\n\n` +
          `**Configuración actual:** ${
            current?.label ||
            "Domingo"
          }\n\n` +
          "Cuando llegue este día, el sistema podrá cerrar la semana y generar el reporte semanal."
        ),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        menu
      ),
      navigationButtons(),
    ],
  });
}

// =====================================================
// GUARDAR FIN DE SEMANA
// =====================================================

async function saveWeekEndDay(
  interaction
) {
  const day =
    Number(
      interaction.values[0]
    );

  if (
    !Number.isInteger(day) ||
    day < 0 ||
    day > 6
  ) {
    await interaction.reply({
      content:
        "❌ El día seleccionado no es válido.",
      ephemeral: true,
    });

    return;
  }

  await ensureGuildConfig(
    interaction.guildId
  );

  db.run(
    `
    UPDATE guild_config
    SET week_end_day = ?
    WHERE guild_id = ?
    `,
    [
      day,
      interaction.guildId,
    ],
    async (err) => {
      if (err) {
        console.error(
          "❌ Error guardando día de semana:",
          err
        );

        await interaction.update({
          embeds: [
            new EmbedBuilder()
              .setTitle(
                "❌ Error"
              )
              .setDescription(
                "No se pudo guardar el día de finalización."
              ),
          ],
          components: [
            navigationButtons(),
          ],
        });

        return;
      }

      const selectedDay =
        DAYS.find(
          (item) =>
            Number(item.value) ===
            day
        );

      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle(
              "✅ Fin de semana configurado"
            )
            .setDescription(
              `La semana de estadísticas terminará los **${selectedDay.label}**.\n\n` +
              "La configuración se guardó correctamente."
            ),
        ],
        components: [
          navigationButtons(),
        ],
      });
    }
  );
}

// =====================================================
// MENÚ DE PESOS
// =====================================================

async function showTaskWeightsMenu(
  interaction
) {
  await ensureGuildConfig(
    interaction.guildId
  );

  const config =
    await getGuildConfig(
      interaction.guildId
    );

  const messages =
    config?.messages_weight ??
    DEFAULT_WEIGHTS.messages;

  const alliances =
    config?.alliances_weight ??
    DEFAULT_WEIGHTS.alliances;

  const affiliations =
    config?.affiliations_weight ??
    DEFAULT_WEIGHTS.affiliations;

  const total =
    Number(messages) +
    Number(alliances) +
    Number(affiliations);

  const embed =
    new EmbedBuilder()
      .setTitle(
        "⚖️ Peso de las tareas"
      )
      .setDescription(
        "Configura cuánto vale cada tipo de tarea en el porcentaje final de cumplimiento.\n\n" +

        `💬 **Mensajes:** ${messages}%\n` +
        `🤝 **Alianzas:** ${alliances}%\n` +
        `🔗 **Afiliaciones:** ${affiliations}%\n\n` +

        `**Total actual:** ${total}%\n\n` +

        "⚠️ Los tres valores deben sumar exactamente **100%**.\n" +
        "Si introduces una combinación diferente de 100%, los valores anteriores se conservarán."
      );

  const button =
    new ButtonBuilder()
      .setCustomId(
        "config_task_weights_edit"
      )
      .setLabel(
        "✏️ Cambiar porcentajes"
      )
      .setStyle(
        ButtonStyle.Primary
      );

  await interaction.update({
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        button
      ),
      navigationButtons(),
    ],
  });
}

// =====================================================
// MODAL DE PESOS
// =====================================================

async function showTaskWeightsModal(
  interaction
) {
  await ensureGuildConfig(
    interaction.guildId
  );

  const config =
    await getGuildConfig(
      interaction.guildId
    );

  const messages =
    config?.messages_weight ??
    DEFAULT_WEIGHTS.messages;

  const alliances =
    config?.alliances_weight ??
    DEFAULT_WEIGHTS.alliances;

  const affiliations =
    config?.affiliations_weight ??
    DEFAULT_WEIGHTS.affiliations;

  const modal =
    new ModalBuilder()
      .setCustomId(
        "config_task_weights_modal"
      )
      .setTitle(
        "⚖️ Peso de las tareas"
      );

  const messagesInput =
    new TextInputBuilder()
      .setCustomId(
        "messages_weight"
      )
      .setLabel(
        "💬 Mensajes (%)"
      )
      .setPlaceholder(
        "Ejemplo: 50"
      )
      .setValue(
        String(messages)
      )
      .setStyle(
        TextInputStyle.Short
      )
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(3);

  const alliancesInput =
    new TextInputBuilder()
      .setCustomId(
        "alliances_weight"
      )
      .setLabel(
        "🤝 Alianzas (%)"
      )
      .setPlaceholder(
        "Ejemplo: 25"
      )
      .setValue(
        String(alliances)
      )
      .setStyle(
        TextInputStyle.Short
      )
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(3);

  const affiliationsInput =
    new TextInputBuilder()
      .setCustomId(
        "affiliations_weight"
      )
      .setLabel(
        "🔗 Afiliaciones (%)"
      )
      .setPlaceholder(
        "Ejemplo: 25"
      )
      .setValue(
        String(affiliations)
      )
      .setStyle(
        TextInputStyle.Short
      )
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(3);

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      messagesInput
    ),
    new ActionRowBuilder().addComponents(
      alliancesInput
    ),
    new ActionRowBuilder().addComponents(
      affiliationsInput
    )
  );

  await interaction.showModal(
    modal
  );
}

// =====================================================
// GUARDAR PESOS
// =====================================================

async function saveTaskWeights(
  interaction
) {
  const messages =
    Number(
      interaction.fields.getTextInputValue(
        "messages_weight"
      )
    );

  const alliances =
    Number(
      interaction.fields.getTextInputValue(
        "alliances_weight"
      )
    );

  const affiliations =
    Number(
      interaction.fields.getTextInputValue(
        "affiliations_weight"
      )
    );

  // -----------------------------------------------
  // VALIDAR NÚMEROS
  // -----------------------------------------------

  if (
    !Number.isInteger(messages) ||
    !Number.isInteger(alliances) ||
    !Number.isInteger(affiliations) ||
    messages < 0 ||
    alliances < 0 ||
    affiliations < 0 ||
    messages > 100 ||
    alliances > 100 ||
    affiliations > 100
  ) {
    await interaction.reply({
      content:
        "❌ Todos los porcentajes deben ser números enteros entre **0% y 100%**.\n\n" +
        "Los valores anteriores se conservaron.",
      ephemeral: true,
    });

    return;
  }

  // -----------------------------------------------
  // VALIDAR TOTAL
  // -----------------------------------------------

  const total =
    messages +
    alliances +
    affiliations;

  if (total !== 100) {
    await interaction.reply({
      content:
        `❌ Los porcentajes deben sumar exactamente **100%**.\n\n` +
        `💬 Mensajes: **${messages}%**\n` +
        `🤝 Alianzas: **${alliances}%**\n` +
        `🔗 Afiliaciones: **${affiliations}%**\n\n` +
        `**Total introducido: ${total}%**\n\n` +
        "Los valores anteriores se conservaron sin cambios.",
      ephemeral: true,
    });

    return;
  }

  // -----------------------------------------------
  // ASEGURAR CONFIGURACIÓN
  // -----------------------------------------------

  await ensureGuildConfig(
    interaction.guildId
  );

  // -----------------------------------------------
  // GUARDAR SOLO SI ES VÁLIDO
  // -----------------------------------------------

  db.run(
    `
    UPDATE guild_config
    SET
      messages_weight = ?,
      alliances_weight = ?,
      affiliations_weight = ?
    WHERE guild_id = ?
    `,
    [
      messages,
      alliances,
      affiliations,
      interaction.guildId,
    ],
    async (err) => {
      if (err) {
        console.error(
          "❌ Error guardando pesos:",
          err
        );

        await interaction.reply({
          content:
            "❌ No se pudieron guardar los porcentajes. Los valores anteriores se conservaron.",
          ephemeral: true,
        });

        return;
      }

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(
              "✅ Pesos actualizados"
            )
            .setDescription(
              "Los porcentajes se actualizaron correctamente.\n\n" +
              `💬 Mensajes — **${messages}%**\n` +
              `🤝 Alianzas — **${alliances}%**\n` +
              `🔗 Afiliaciones — **${affiliations}%**\n\n` +
              `**Total: 100%**`
            ),
        ],
        ephemeral: true,
      });
    }
  );
}

// =====================================================
// GUARDAR CANAL
// =====================================================

async function saveChannel(
  interaction,
  type
) {
  const channelId =
    interaction.values[0];

  const columns = {
    alliance_channel:
      "alliance_channel_id",

    affiliation_channel:
      "affiliation_channel_id",

    alliance_log_channel:
      "alliance_log_channel_id",

    affiliation_log_channel:
      "affiliation_log_channel_id",

    daily_report_channel:
      "daily_report_channel_id",

    weekly_report_channel:
      "weekly_report_channel_id",
  };

  const column =
    columns[type];

  if (!column) {
    return;
  }

  await ensureGuildConfig(
    interaction.guildId
  );

  db.run(
    `
    UPDATE guild_config
    SET ${column} = ?
    WHERE guild_id = ?
    `,
    [
      channelId,
      interaction.guildId,
    ],
    async (err) => {
      if (err) {
        console.error(
          "❌ Error guardando canal:",
          err
        );

        await interaction.update({
          embeds: [
            new EmbedBuilder()
              .setTitle(
                "❌ Error"
              )
              .setDescription(
                "No se pudo guardar el canal."
              ),
          ],
          components: [
            navigationButtons(
              "config_channels_menu"
            ),
          ],
        });

        return;
      }

      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle(
              "✅ Configuración guardada"
            )
            .setDescription(
              `Canal configurado correctamente.\n\n` +
              `Canal seleccionado: <#${channelId}>`
            ),
        ],
        components: [
          navigationButtons(
            "config_channels_menu"
          ),
        ],
      });
    }
  );
}

// =====================================================
// MANEJADOR PRINCIPAL
// =====================================================

async function handleConfigInteraction(
  interaction
) {

  // ===================================================
  // /CONFIG
  // ===================================================

  if (
    interaction.isChatInputCommand() &&
    interaction.commandName === "config"
  ) {
    await showMainMenu(
      interaction
    );

    return;
  }

  // ===================================================
  // MODALES
  // ===================================================

  if (
    interaction.isModalSubmit()
  ) {

    // -----------------------------------------------
    // MODAL DE TAREAS
    // -----------------------------------------------

    if (
      interaction.customId.startsWith(
        "task_modal_"
      )
    ) {
      const parts =
        interaction.customId.split(
          "_"
        );

      const type =
        parts[2];

      const roleId =
        parts[3];

      await saveTask(
        interaction,
        type,
        roleId
      );

      return;
    }

    // -----------------------------------------------
    // MODAL DE PESOS
    // -----------------------------------------------

    if (
      interaction.customId ===
      "config_task_weights_modal"
    ) {
      await saveTaskWeights(
        interaction
      );

      return;
    }
  }

  // ===================================================
  // BOTONES
  // ===================================================

  if (
    interaction.isButton()
  ) {

    // -----------------------------------------------
    // MENÚ PRINCIPAL
    // -----------------------------------------------

    if (
      interaction.customId ===
      "config_home"
    ) {
      await showMainMenu(
        interaction,
        true
      );

      return;
    }

    // -----------------------------------------------
    // ROLES
    // -----------------------------------------------

    if (
      interaction.customId ===
      "config_roles_menu"
    ) {
      await showRolesMenu(
        interaction
      );

      return;
    }

    // -----------------------------------------------
    // CANALES
    // -----------------------------------------------

    if (
      interaction.customId ===
      "config_channels_menu"
    ) {
      await showChannelsMenu(
        interaction
      );

      return;
    }

    // -----------------------------------------------
    // TAREAS
    // -----------------------------------------------

    if (
      interaction.customId ===
      "config_tasks_menu" ||
      interaction.customId ===
      "config_tasks_type"
    ) {
      await showTasksMenu(
        interaction
      );

      return;
    }

    // -----------------------------------------------
    // PESOS
    // -----------------------------------------------

    if (
      interaction.customId ===
      "config_task_weights"
    ) {
      await showTaskWeightsMenu(
        interaction
      );

      return;
    }

    // -----------------------------------------------
    // EDITAR PESOS
    // -----------------------------------------------

    if (
      interaction.customId ===
      "config_task_weights_edit"
    ) {
      await showTaskWeightsModal(
        interaction
      );

      return;
    }

    // -----------------------------------------------
    // VOLVER A ROLES DE TAREAS
    // -----------------------------------------------

    if (
      interaction.customId.startsWith(
        "tasks_select_role_"
      )
    ) {
      const type =
        interaction.customId.replace(
          "tasks_select_role_",
          ""
        );

      if (
        type === "staff" ||
        type === "admin"
      ) {
        interaction.values =
          [type];

        await showTaskRoleSelector(
          interaction
        );

        return;
      }
    }

    // -----------------------------------------------
    // MENSAJES
    // -----------------------------------------------

    if (
      interaction.customId.startsWith(
        "task_messages_"
      )
    ) {
      const roleId =
        interaction.customId.replace(
          "task_messages_",
          ""
        );

      await showTaskModal(
        interaction,
        "messages",
        roleId
      );

      return;
    }

    // -----------------------------------------------
    // ALIANZAS
    // -----------------------------------------------

    if (
      interaction.customId.startsWith(
        "task_alliances_"
      )
    ) {
      const roleId =
        interaction.customId.replace(
          "task_alliances_",
          ""
        );

      await showTaskModal(
        interaction,
        "alliances",
        roleId
      );

      return;
    }

    // -----------------------------------------------
    // AFILIACIONES
    // -----------------------------------------------

    if (
      interaction.customId.startsWith(
        "task_affiliations_"
      )
    ) {
      const roleId =
        interaction.customId.replace(
          "task_affiliations_",
          ""
        );

      await showTaskModal(
        interaction,
        "affiliations",
        roleId
      );

      return;
    }
  }

  // ===================================================
  // MENÚ PRINCIPAL
  // ===================================================

  if (
    interaction.isStringSelectMenu() &&
    interaction.customId ===
      "config_menu"
  ) {
    const value =
      interaction.values[0];

    if (value === "roles") {
      await showRolesMenu(
        interaction
      );
      return;
    }

    if (value === "channels") {
      await showChannelsMenu(
        interaction
      );
      return;
    }

    if (value === "tasks") {
      await showTasksMenu(
        interaction
      );
      return;
    }

    if (value === "week_end") {
      await showWeekEndMenu(
        interaction
      );
      return;
    }

    if (value === "reset_time") {
      await showResetTimeMenu(
        interaction
      );
      return;
    }

    if (value === "task_weights") {
      await showTaskWeightsMenu(
        interaction
      );
      return;
    }
  }

  // ===================================================
  // MENÚ DE ROLES
  // ===================================================

  if (
    interaction.isStringSelectMenu() &&
    interaction.customId ===
      "config_roles_menu"
  ) {
    await showRoleSelector(
      interaction
    );

    return;
  }

  // ===================================================
  // STAFF
  // ===================================================

  if (
    interaction.isRoleSelectMenu() &&
    interaction.customId ===
      "select_staff_roles"
  ) {
    await saveMultipleRoles(
      interaction,
      "staff_roles"
    );

    return;
  }

  // ===================================================
  // ADMIN
  // ===================================================

  if (
    interaction.isRoleSelectMenu() &&
    interaction.customId ===
      "select_admin_roles"
  ) {
    await saveMultipleRoles(
      interaction,
      "admin_roles"
    );

    return;
  }

  // ===================================================
  // TIPO DE TAREAS
  // ===================================================

  if (
    interaction.isStringSelectMenu() &&
    interaction.customId ===
      "config_tasks_type"
  ) {
    await showTaskRoleSelector(
      interaction
    );

    return;
  }

  // ===================================================
  // ROL STAFF
  // ===================================================

  if (
    interaction.isStringSelectMenu() &&
    interaction.customId ===
      "tasks_select_role_staff"
  ) {
    await showRoleTasks(
      interaction,
      "staff"
    );

    return;
  }

  // ===================================================
  // ROL ADMIN
  // ===================================================

  if (
    interaction.isStringSelectMenu() &&
    interaction.customId ===
      "tasks_select_role_admin"
  ) {
    await showRoleTasks(
      interaction,
      "admin"
    );

    return;
  }

  // ===================================================
  // MENÚ DE CANALES
  // ===================================================

  if (
    interaction.isStringSelectMenu() &&
    interaction.customId ===
      "config_channels_menu"
  ) {
    await showChannelSelector(
      interaction
    );

    return;
  }

  // ===================================================
  // SELECTOR DE CANAL
  // ===================================================

  if (
    interaction.isChannelSelectMenu() &&
    interaction.customId.startsWith(
      "channel_"
    )
  ) {
    const type =
      interaction.customId.replace(
        "channel_",
        ""
      );

    await saveChannel(
      interaction,
      type
    );

    return;
  }

  // ===================================================
  // SELECTOR DE HORA
  // ===================================================

  if (
    interaction.isStringSelectMenu() &&
    interaction.customId ===
      "config_reset_time"
  ) {
    await saveResetTime(
      interaction
    );

    return;
  }

  // ===================================================
  // SELECTOR DE FIN DE SEMANA
  // ===================================================

  if (
    interaction.isStringSelectMenu() &&
    interaction.customId ===
      "config_week_end"
  ) {
    await saveWeekEndDay(
      interaction
    );

    return;
  }
}

// =====================================================
// EXPORTAR
// =====================================================

module.exports = {
  command,
  handleConfigInteraction,
};