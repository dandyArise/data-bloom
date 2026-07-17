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

export function parseSelectedWidgetCommands(prompt: string) {
  const commands: WidgetSlashCommand[] = [];
  let remainder = prompt;
  while (true) {
    const match = remainder.match(/^\/([a-z0-9-]+)\s+/i);
    if (!match) break;
    const command = widgetSlashCommands.find((item) => item.type === match[1].toLocaleLowerCase('fr'));
    if (!command) break;
    if (!commands.some((item) => item.type === command.type)) commands.push(command);
    remainder = remainder.slice(match[0].length);
  }
  return { commands, text: remainder };
}

export function composeWidgetPrompt(commands: WidgetSlashCommand[], text: string) {
  const prefix = commands.map((command) => command.command).join(' ');
  return prefix ? `${prefix} ${text}` : text;
}

export function expandWidgetSlashCommand(prompt: string) {
  const definitions: Array<NonNullable<ReturnType<typeof getWidgetDefinition>>> = [];
  let remainder = prompt.trim();
  while (true) {
    const match = remainder.match(/^\/([a-z0-9-]+)(?=\s|$)/i);
    if (!match) break;
    const definition = getWidgetDefinition(match[1].toLocaleLowerCase('fr'));
    if (!definition) break;
    if (!definitions.some((item) => item.type === definition.type)) definitions.push(definition);
    remainder = remainder.slice(match[0].length).trimStart();
  }
  if (definitions.length === 0) return prompt;

  const details = remainder.trim();
  const requestedWidgets = definitions.map((definition) => `"${definition.type}" (${definition.label})`).join(', ');
  const instruction = definitions.length === 1
    ? `Crée un widget de type exact ${requestedWidgets}. Retourne cette proposition dans widgets et n utilise pas un autre type.`
    : `Crée exactement les widgets suivants : ${requestedWidgets}. Retourne une proposition pour chacun dans widgets et n utilise pas d autres types.`;
  return details ? `${instruction} Demande complémentaire : ${details}` : instruction;
}
