import { ActionError } from "astro:actions";

type ActionHandler<TInput, TOutput> = (
  input: TInput,
  context: { userId: string; avatarUrl: string | null; [key: string]: any }
) => Promise<TOutput>;

export function defineProtectedAction<TInput, TOutput>(
  handler: ActionHandler<TInput, TOutput>
) {
  return async (input: TInput, context: any) => {
    const { user_id, avatar_url } = context.locals;
    if (!user_id) {
      throw new ActionError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to perform this action.",
      });
    }

    // Call the handler with an injected "userId" for convenience
    return handler(input, { ...context, userId: user_id, avatarUrl: avatar_url });
  };
}