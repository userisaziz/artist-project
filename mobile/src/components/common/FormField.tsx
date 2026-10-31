import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import type { ComponentProps } from 'react';
import { AppTextField } from './AppTextField';

type FieldProps = Omit<ComponentProps<typeof AppTextField>, 'value' | 'onChangeText' | 'onBlur' | 'error'>;

interface FormFieldProps<V extends FieldValues> extends FieldProps {
  control: Control<V, unknown, FieldValues>;
  /** The key in the form's values, e.g. `'details'` or `'contact.phone'`. */
  name: Path<V>;
}

/**
 * The app's binding between a React Hook Form field and the house text input.
 *
 * One place owns the wiring (`value`, `onChangeText`, `onBlur`) and the one thing every form used to
 * hand-roll: showing the schema's message for this field under the field. Feature forms pass the label
 * and the input props and say nothing about validation state.
 */
export function FormField<V extends FieldValues>({ control, name, ...rest }: FormFieldProps<V>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <AppTextField
          {...rest}
          value={field.value as string}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={fieldState.error?.message ?? null}
        />
      )}
    />
  );
}
