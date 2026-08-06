"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type FormSubmitButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  "type"
> & {
  pendingLabel: string;
};

/** Keeps the form usable while preventing duplicate server submissions. */
function FormSubmitButton({
  children,
  disabled,
  pendingLabel,
  ...props
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={disabled || pending}
      aria-disabled={disabled || pending}
      {...props}
    >
      {pending ? (
        <>
          <Spinner aria-hidden="true" />
          <span aria-live="polite">{pendingLabel}</span>
        </>
      ) : (
        children
      )}
    </Button>
  );
}

export { FormSubmitButton };
