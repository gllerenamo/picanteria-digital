import { z } from 'zod';

/**
 * Mensajes de validación por defecto en español (Principio III). Los esquemas que necesitan
 * un mensaje más preciso lo definen explícitamente.
 */
const spanishErrorMap: z.ZodErrorMap = (issue) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      return {
        message: issue.received === 'undefined' ? 'Este campo es obligatorio' : 'El valor no es válido',
      };
    case z.ZodIssueCode.unrecognized_keys:
      return { message: `Campos no permitidos: ${issue.keys.join(', ')}` };
    case z.ZodIssueCode.invalid_enum_value:
      return { message: 'Elige una de las opciones disponibles' };
    case z.ZodIssueCode.invalid_string:
      return { message: 'El formato no es válido' };
    case z.ZodIssueCode.too_small:
      return { message: 'El valor es demasiado corto' };
    case z.ZodIssueCode.too_big:
      return { message: 'El valor es demasiado largo' };
    default:
      return { message: 'El valor no es válido' };
  }
};

z.setErrorMap(spanishErrorMap);
