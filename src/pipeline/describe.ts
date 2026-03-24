import type { Config } from '../config.js';
import type { FrameSet, AnimationCode } from '../types/index.js';

export async function describeAnimations(
  frames: FrameSet[],
  code: AnimationCode[],
  config: Config,
): Promise<string[] | undefined> {
  if (!config.autoDescribe || !config.anthropicApiKey) {
    return undefined;
  }

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: config.anthropicApiKey });

    const imageContent = frames
      .flatMap((fs) => fs.frames)
      .slice(0, 5)
      .map((f) => ({
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: 'image/jpeg' as const,
          data: f.image,
        },
      }));

    const codeContext = code
      .map((c) => {
        const parts: string[] = [`Element: ${c.animation.selector}`];
        if (c.css?.keyframes) parts.push(`Keyframes: ${c.css.keyframes}`);
        if (c.css?.transitions) parts.push(`Transition: ${c.css.transitions}`);
        if (c.js?.rawSnippet) parts.push(`JS: ${c.js.rawSnippet}`);
        if (c.timing.duration) parts.push(`Duration: ${c.timing.duration}ms`);
        if (c.timing.easing) parts.push(`Easing: ${c.timing.easing}`);
        return parts.join('\n');
      })
      .join('\n\n');

    const message = await client.messages.create({
      model: config.descriptionModel,
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            ...imageContent,
            {
              type: 'text',
              text: `Describe the animations visible in these website screenshots. Here is the extracted animation code for context:\n\n${codeContext}\n\nFor each animation, describe: what element animates, what the animation does visually, the trigger (scroll, hover, page load), timing/easing, and the overall effect. Be specific and technical.`,
            },
          ],
        },
      ],
    });

    const text = message.content
      .filter((b) => b.type === 'text')
      .map((b) => ('text' in b ? b.text : ''))
      .join('\n');

    return text ? [text] : undefined;
  } catch {
    return undefined;
  }
}
