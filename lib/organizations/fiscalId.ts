/**
 * Validación de CIF, NIF y NIE en el formulario de alta de entidad, con el
 * mismo criterio que el backend (`entities/validators.py`): solo forma y
 * dígito o letra de control, sin consultar ningún registro. El backend
 * sigue siendo quien decide; esto solo avisa antes de enviar.
 */
const LETRAS_NIF = "TRWAGMYFPDXBNJZSQVHLCKE";
const LETRAS_CIF = "JABCDEFGHI";
const CONTROL_LETRA = "PQRSNW";
const CONTROL_DIGITO = "ABEH";

const RE_CIF = /^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/;
const RE_NIF = /^(\d{8})([A-Z])$/;
const RE_NIF_ESPECIAL = /^([KLM])(\d{7})([A-Z])$/;
const RE_NIE = /^([XYZ])(\d{7})([A-Z])$/;

/** Mayúsculas y sin espacios, guiones ni puntos. */
export function normalizeFiscalId(value: string): string {
  return value.replace(/[\s\-.]/g, "").toUpperCase();
}

function cifValido(codigo: string): boolean {
  const m = RE_CIF.exec(codigo);
  if (!m) return false;
  const [, tipo, cuerpo, control] = m;
  let pares = 0;
  let impares = 0;
  for (let i = 0; i < cuerpo.length; i += 1) {
    const n = Number(cuerpo[i]);
    if (i % 2 === 1) pares += n;
    else {
      const doble = n * 2;
      impares += Math.floor(doble / 10) + (doble % 10);
    }
  }
  const digito = (10 - ((pares + impares) % 10)) % 10;
  const letra = LETRAS_CIF[digito];
  if (CONTROL_LETRA.includes(tipo)) return control === letra;
  if (CONTROL_DIGITO.includes(tipo)) return control === String(digito);
  return control === letra || control === String(digito);
}

function nifValido(codigo: string): boolean {
  let m = RE_NIF.exec(codigo);
  if (m) return LETRAS_NIF[Number(m[1]) % 23] === m[2];
  m = RE_NIF_ESPECIAL.exec(codigo);
  if (m) return LETRAS_NIF[Number(m[2]) % 23] === m[3];
  m = RE_NIE.exec(codigo);
  if (m) return LETRAS_NIF[Number(String("XYZ".indexOf(m[1])) + m[2]) % 23] === m[3];
  return false;
}

/** ¿Es un CIF, NIF o NIE con su control correcto? */
export function isValidFiscalId(value: string): boolean {
  const codigo = normalizeFiscalId(value);
  return cifValido(codigo) || nifValido(codigo);
}
