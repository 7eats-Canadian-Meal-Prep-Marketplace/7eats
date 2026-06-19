import { toast } from "sonner";

const MEAL_SUCCESS_MS = 2000;
const MEAL_ERROR_MS = 3200;

const baseClassNames = {
  toast: "meal-toast",
  title: "meal-toast__title",
  icon: "meal-toast__icon",
} as const;

/** Short, styled feedback for meal create / archive / delete actions. */
export function mealToastSuccess(message: string) {
  toast.success(message, {
    duration: MEAL_SUCCESS_MS,
    closeButton: false,
    classNames: baseClassNames,
  });
}

export function mealToastError(message: string) {
  toast.error(message, {
    duration: MEAL_ERROR_MS,
    closeButton: false,
    classNames: {
      ...baseClassNames,
      toast: "meal-toast meal-toast--error",
    },
  });
}
