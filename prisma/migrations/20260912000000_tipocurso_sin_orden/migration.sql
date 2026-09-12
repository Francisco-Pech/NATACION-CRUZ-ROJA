-- El orden manual de los cursos no le servía a nadie: alfabéticamente
-- quedan igual (Curso Adultos, Curso Niños, Personalizado, Salvavidas) y
-- era un campo más que llenar sin razón. Se ordena por nombre.
--
-- Horario.orden y los de TipoPago/FrecuenciaPago se quedan: ahí sí
-- importan, porque una franja horaria no se ordena alfabéticamente y el
-- motor de cobro usa el orden para desempatar de forma determinista.
ALTER TABLE "TipoCurso" DROP COLUMN "orden";
