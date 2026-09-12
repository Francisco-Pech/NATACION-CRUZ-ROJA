import { describe, it, expect } from 'vitest'
import {
  normalizarClave,
  validarCurso,
  validarCatalogo,
  validarFranja,
  validarEntero,
  aEntero,
  LARGO_CLAVE,
  LARGO_NOMBRE,
  LARGO_DESCRIPCION,
} from '@/lib/validaciones'

describe('normalizarClave', () => {
  it('pasa a mayúsculas', () => {
    expect(normalizarClave('adultos')).toBe('ADULTOS')
  })

  // La delegación escribe en español: "Natación" no debe quedar en "NATACIN".
  it('quita los acentos en vez de borrar la letra', () => {
    expect(normalizarClave('Natación')).toBe('NATACION')
    expect(normalizarClave('Niños')).toBe('NINOS')
  })

  it('cambia los espacios por guion bajo', () => {
    expect(normalizarClave('hora libre')).toBe('HORA_LIBRE')
  })

  it('descarta lo que no sirve como clave', () => {
    expect(normalizarClave('¡Curso #1!')).toBe('CURSO_1')
  })

  it('no deja guiones bajos de sobra en las orillas', () => {
    expect(normalizarClave('  curso  ')).toBe('CURSO')
    expect(normalizarClave('--curso--')).toBe('CURSO')
  })

  it('de puros símbolos no sale nada', () => {
    expect(normalizarClave('!!!')).toBe('')
  })
})

describe('validarCurso · nombre', () => {
  it('acepta un nombre normal', () => {
    expect(validarCurso({ nombre: 'Curso Adultos', clave: 'ADULTOS' })).toBeNull()
  })

  it('exige el nombre', () => {
    expect(validarCurso({ nombre: '', clave: 'X1' })).toMatch(/nombre/i)
  })

  it('un nombre de puros espacios es un nombre vacío', () => {
    expect(validarCurso({ nombre: '    ', clave: 'X1' })).toMatch(/nombre/i)
  })

  it('rechaza un nombre demasiado corto', () => {
    expect(validarCurso({ nombre: 'ab', clave: 'X1' })).toMatch(/corto/i)
  })

  it('rechaza un nombre absurdamente largo', () => {
    const largo = 'a'.repeat(LARGO_NOMBRE.max + 1)
    expect(validarCurso({ nombre: largo, clave: 'X1' })).toMatch(/largo/i)
  })

  it('acepta justo el largo máximo', () => {
    expect(validarCurso({ nombre: 'a'.repeat(LARGO_NOMBRE.max), clave: 'X1' })).toBeNull()
  })
})

describe('validarCurso · clave', () => {
  it('exige la clave al crear', () => {
    expect(validarCurso({ nombre: 'Curso Adultos', clave: '' })).toMatch(/clave/i)
  })

  it('rechaza una clave demasiado larga', () => {
    const larga = 'A'.repeat(LARGO_CLAVE.max + 1)
    expect(validarCurso({ nombre: 'Curso Adultos', clave: larga })).toMatch(/larga/i)
  })

  // Al editar la clave no se toca: es lo que sostiene al seeder.
  it('al editar no se pide clave', () => {
    expect(validarCurso({ nombre: 'Curso Adultos' })).toBeNull()
  })
})

describe('validarCatalogo', () => {
  it('acepta un nombre y una clave buenos', () => {
    expect(validarCatalogo({ nombre: 'Pago único', clave: 'UNICO' })).toBeNull()
  })

  it('exige el nombre', () => {
    expect(validarCatalogo({ nombre: '   ' })).toMatch(/nombre/i)
  })

  it('exige la clave cuando se está creando', () => {
    expect(validarCatalogo({ nombre: 'Mensual', clave: '  ' })).toMatch(/clave/i)
  })

  it('no pide clave al editar', () => {
    expect(validarCatalogo({ nombre: 'Mensual' })).toBeNull()
  })
})

describe('validarFranja', () => {
  it('acepta una franja normal', () => {
    expect(validarFranja('06:00', '07:00')).toBeNull()
  })

  it('exige las dos horas', () => {
    expect(validarFranja('', '07:00')).toMatch(/hora/i)
    expect(validarFranja('06:00', '')).toMatch(/hora/i)
  })

  it('rechaza una hora mal escrita', () => {
    expect(validarFranja('6am', '07:00')).toMatch(/hora/i)
    expect(validarFranja('06:00', '25:00')).toMatch(/hora/i)
  })

  it('rechaza que termine antes de empezar', () => {
    expect(validarFranja('07:00', '06:00')).toMatch(/termina|antes|después/i)
  })

  it('rechaza una franja de duración cero', () => {
    expect(validarFranja('07:00', '07:00')).toMatch(/termina|antes|después/i)
  })
})

describe('validarEntero', () => {
  it('acepta un número dentro del rango', () => {
    expect(validarEntero(3, { min: 1, max: 12, campo: 'Los meses' })).toBeNull()
  })

  it('rechaza lo que no es número', () => {
    expect(validarEntero(NaN, { min: 1, max: 12, campo: 'Los meses' })).toMatch(/meses/i)
  })

  it('rechaza fuera de rango por abajo y por arriba', () => {
    expect(validarEntero(0, { min: 1, max: 12, campo: 'Los meses' })).toMatch(/1/)
    expect(validarEntero(13, { min: 1, max: 12, campo: 'Los meses' })).toMatch(/12/)
  })

  it('rechaza los decimales', () => {
    expect(validarEntero(2.5, { min: 1, max: 12, campo: 'Los meses' })).toMatch(/entero|meses/i)
  })
})

describe('aEntero', () => {
  it('lee un número normal', () => {
    expect(aEntero('7')).toBe(7)
    expect(aEntero(' 7 ')).toBe(7)
  })

  it('da NaN cuando el campo viene vacío, no 0', () => {
    // `Number('')` es 0, y eso hacía que un campo en blanco pasara como
    // cero válido en vez de avisar que falta.
    expect(aEntero('')).toBeNaN()
    expect(aEntero('   ')).toBeNaN()
    expect(aEntero(null)).toBeNaN()
    expect(aEntero(undefined)).toBeNaN()
  })

  it('da NaN cuando no es un número', () => {
    expect(aEntero('lunes')).toBeNaN()
  })

  it('conserva el decimal para que la validación lo pueda rechazar', () => {
    expect(aEntero('2.5')).toBe(2.5)
  })

  it('el cero sí es un cero', () => {
    expect(aEntero('0')).toBe(0)
  })
})

describe('validarEntero con el día del calendario', () => {
  const DIA = { min: 0, max: 6, campo: 'El día del calendario' }
  const revisar = (bruto: string) => validarEntero(aEntero(bruto), { ...DIA, bruto })

  it('acepta los siete días del calendario', () => {
    for (const n of [0, 1, 2, 3, 4, 5, 6]) {
      expect(revisar(String(n))).toBeNull()
    }
  })

  it('rechaza un decimal: no existe el día 2.5', () => {
    expect(revisar('2.5')).toMatch(/entero/i)
    expect(revisar('0.1')).toMatch(/entero/i)
    expect(revisar('-0.5')).toMatch(/entero/i)
  })

  it('acepta un decimal que en realidad es entero', () => {
    expect(revisar('2.0')).toBeNull()
  })

  it('rechaza lo que se sale del calendario', () => {
    expect(revisar('7')).toMatch(/máximo es 6/)
    expect(revisar('-1')).toMatch(/mínimo es 0/)
    expect(revisar('1e3')).toMatch(/máximo es 6/)
  })

  it('rechaza texto y nombres de día, y repite lo que se escribió', () => {
    expect(revisar('lunes')).toMatch(/"lunes" no es un número/)
    expect(revisar('2,5')).toMatch(/"2,5" no es un número/)
  })

  it('avisa que falta cuando el campo viene vacío', () => {
    expect(revisar('')).toMatch(/falta/i)
    expect(revisar('   ')).toMatch(/falta/i)
  })

  it('no dice "falta" cuando sí se escribió algo, solo que no es número', () => {
    // Decir "falta el número" cuando la persona escribió "lunes" la manda a
    // buscar un campo vacío que no existe.
    expect(revisar('lunes')).not.toMatch(/falta/i)
  })

  it('rechaza el infinito y otras rarezas', () => {
    expect(revisar('Infinity')).toMatch(/no es un número/)
    expect(revisar('NaN')).toMatch(/no es un número/)
  })

  it('sin el texto original se conforma con avisar que hace falta', () => {
    expect(validarEntero(Number.NaN, DIA)).toMatch(/falta/i)
  })
})

describe('validarFranja a medianoche', () => {
  it('acepta 24:00 como hora de fin: es el cierre del día', () => {
    // Sin esto no se puede tener la franja de 23:00 a medianoche, y el
    // catálogo de 24 horas queda con 23.
    expect(validarFranja('23:00', '24:00')).toBeNull()
  })

  it('no acepta 24:00 como hora de inicio', () => {
    expect(validarFranja('24:00', '24:00')).toMatch(/hora de inicio/i)
  })

  it('sigue rechazando 25:00', () => {
    expect(validarFranja('23:00', '25:00')).toMatch(/hora de fin/i)
  })

  it('ordena bien contra las demás horas', () => {
    expect('24:00' > '23:00').toBe(true)
  })
})

describe('validarFranja exige una hora de verdad, no cualquier texto', () => {
  it('acepta el formato de 24 horas con dos dígitos', () => {
    expect(validarFranja('00:00', '01:00')).toBeNull()
    expect(validarFranja('09:30', '10:15')).toBeNull()
    expect(validarFranja('23:00', '24:00')).toBeNull()
  })

  it('rechaza la hora sin el cero de adelante', () => {
    expect(validarFranja('8:00', '09:00')).toMatch(/hora de inicio/i)
  })

  it('rechaza los segundos', () => {
    expect(validarFranja('08:00:00', '09:00')).toMatch(/hora de inicio/i)
  })

  it('rechaza am/pm', () => {
    expect(validarFranja('8:00 am', '9:00 am')).toMatch(/hora de inicio/i)
    expect(validarFranja('08:00', '9pm')).toMatch(/hora de fin/i)
  })

  it('rechaza horas y minutos que no existen', () => {
    expect(validarFranja('25:00', '26:00')).toMatch(/hora de inicio/i)
    expect(validarFranja('08:60', '09:00')).toMatch(/hora de inicio/i)
    expect(validarFranja('08:99', '09:00')).toMatch(/hora de inicio/i)
  })

  it('rechaza texto suelto y números pelones', () => {
    for (const basura of ['mañana', '8', '0800', '08-00', '08.00', 'null']) {
      expect(validarFranja(basura, '09:00')).toMatch(/hora de inicio/i)
    }
  })

  it('dice qué fue lo que no entendió', () => {
    expect(validarFranja('mañana', '09:00')).toContain('mañana')
    expect(validarFranja('08:00', 'tarde')).toContain('tarde')
  })

  it('no se traga los espacios de más como si fueran vacío', () => {
    expect(validarFranja('  08:00  ', '  09:00  ')).toBeNull()
  })
})

describe('la descripción es libre y opcional', () => {
  it('acepta que no venga', () => {
    expect(validarCatalogo({ nombre: 'Curso Adultos' })).toBeNull()
    expect(validarCatalogo({ nombre: 'Curso Adultos', descripcion: '' })).toBeNull()
    expect(validarCatalogo({ nombre: 'Curso Adultos', descripcion: '   ' })).toBeNull()
  })

  it('acepta un texto normal', () => {
    expect(validarCatalogo({
      nombre: 'Curso Adultos',
      descripcion: 'Natación para mayores de 18, de lunes a viernes.',
    })).toBeNull()
  })

  it('corta los textos larguísimos', () => {
    expect(validarCatalogo({ nombre: 'Curso Adultos', descripcion: 'x'.repeat(201) }))
      .toMatch(/descripci/i)
  })

  it('acepta justo el largo máximo', () => {
    expect(validarCatalogo({ nombre: 'Curso Adultos', descripcion: 'x'.repeat(LARGO_DESCRIPCION.max) }))
      .toBeNull()
  })

  it('el nombre sigue siendo obligatorio aunque haya descripción', () => {
    expect(validarCatalogo({ nombre: '', descripcion: 'algo' })).toMatch(/nombre/i)
  })
})

describe('la clave se saca del nombre, ya no se teclea', () => {
  it('convierte el nombre en una clave utilizable', () => {
    expect(normalizarClave('Curso Adultos')).toBe('CURSO_ADULTOS')
    expect(normalizarClave('Pago único')).toBe('PAGO_UNICO')
    expect(normalizarClave('Miércoles')).toBe('MIERCOLES')
    expect(normalizarClave('Niños')).toBe('NINOS')
  })

  it('un nombre que no deja ninguna letra no da clave', () => {
    expect(normalizarClave('!!!')).toBe('')
  })
})
