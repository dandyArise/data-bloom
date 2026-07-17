import type { WidgetType } from './types';
import { getWidgetDefinition, widgetRegistry } from './widgetRegistry';

export type WidgetSlashCommand = {
  command: string;
  type: WidgetType;
  label: string;
};

const widgetSlashCommands: WidgetSlashCommand[] = [];
for (const definition of widgetRegistry.values()) {
  widgetSlashCommands.push({
    command: `/${definition.type}`,
    type: definition.type,
    label: definition.label,
  });
}

export function getWidgetSlashCommands(query = '') {
  const normalizedQuery = query.trim().toLocaleLowerCase('fr');
  if (!normalizedQuery) return widgetSlashCommands;

  const prefixMatches: WidgetSlashCommand[] = [];
  const partialMatches: WidgetSlashCommand[] = [];
  for (const option of widgetSlashCommands) {
    const normalizedType = option.type.toLocaleLowerCase('fr');
    const normalizedLabel = option.label.toLocaleLowerCase('fr');
    if (normalizedType.startsWith(normalizedQuery) || normalizedLabel.startsWith(normalizedQuery)) {
      prefixMatches.push(option);
    } else if (normalizedType.includes(normalizedQuery) || normalizedLabel.includes(normalizedQuery)) {
      partialMatches.push(option);
    }
  }
  return [...prefixMatches, ...partialMatches];
}

export function expandWidgetSlashCommand(prompt: string) {
  const match = prompt.trim().match(/^\/([a-z0-9-]+)(?:\s+([\s\S]*))?$/i);
  if (!match) return prompt;

  const definition = getWidgetDefinition(match[1].toLocaleLowerCase('fr'));
  if (!definition) return prompt;

  const details = match[2]?.trim();
  const instruction = `Crée un widget de type exact "${definition.type}" (${definition.label}). Retourne cette proposition dans widgets et n utilise pas un autre type.`;
  return details ? `${instruction} Demande complémentaire : ${details}` : instruction;
}
