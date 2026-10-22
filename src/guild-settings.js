
const supabase = require("./supabase");

const DEFAULT_SETTINGS = {
  language: "es",
  prefix: "J!",
};

async function getGuildSettings(guildId) {
  if (!guildId) {
    throw new Error("Se necesita el ID del servidor.");
  }

  const { data, error } = await supabase
    .from("guild_settings")
    .select("guild_id, language, prefix")
    .eq("guild_id", guildId)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo leer la configuración: ${error.message}`);
  }

  if (data) {
    return data;
  }

  const { data: created, error: insertError } = await supabase
    .from("guild_settings")
    .insert({
      guild_id: guildId,
      ...DEFAULT_SETTINGS,
    })
    .select("guild_id, language, prefix")
    .single();

  if (insertError) {
    throw new Error(
      `No se pudo crear la configuración: ${insertError.message}`
    );
  }

  return created;
}

async function updateGuildSettings(guildId, changes) {
  if (!guildId) {
    throw new Error("Se necesita el ID del servidor.");
  }

  const allowedChanges = {};

  if (changes.language !== undefined) {
    if (!["es", "en"].includes(changes.language)) {
      throw new Error("El idioma debe ser 'es' o 'en'.");
    }

    allowedChanges.language = changes.language;
  }

  if (changes.prefix !== undefined) {
    if (
      typeof changes.prefix !== "string" ||
      changes.prefix.length < 1 ||
      changes.prefix.length > 5
    ) {
      throw new Error("El prefijo debe tener entre 1 y 5 caracteres.");
    }

    allowedChanges.prefix = changes.prefix;
  }

  if (Object.keys(allowedChanges).length === 0) {
    return getGuildSettings(guildId);
  }

  const { error: upsertError } = await supabase
    .from("guild_settings")
    .upsert(
      {
        guild_id: guildId,
        ...DEFAULT_SETTINGS,
        ...allowedChanges,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "guild_id" }
    );

  if (upsertError) {
    throw new Error(
      `No se pudo guardar la configuración: ${upsertError.message}`
    );
  }

  return getGuildSettings(guildId);
}

module.exports = {
  getGuildSettings,
  updateGuildSettings,
};
