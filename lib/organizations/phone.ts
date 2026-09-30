/**
 * Un teléfono de entidad (`contact_phone`, `help_phone`), con el mismo
 * criterio que `entities/serializers.py::_validar_telefono` del backend:
 * vacío vale (sin teléfono); si no, `+` opcional al principio, solo
 * dígitos y separadores (espacios, puntos, guiones, paréntesis) y entre 3 y
 * 15 dígitos (el 024 o el 016 valen, igual que +34 943 123 456). Informe
 * del panel, error 40.
 */
const PHONE_SHAPE = /^\+?[\d\s().-]+$/;

export function isValidPhone(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return true;
  const digits = trimmed.replace(/\D/g, "").length;
  return PHONE_SHAPE.test(trimmed) && digits >= 3 && digits <= 15;
}
