-- Los precios que confirmó la Delegación para 2026.
--
-- Personalizado estaba en 1,500: era un número inventado para que el
-- sistema no quedara sin precio, y quedó marcado como por confirmar desde
-- que se sembró.
UPDATE "Tarifa" t SET "monto" = 70000
FROM "TipoCurso" c
WHERE c."id" = t."tipoCursoId" AND c."clave" = 'PERSONALIZADO';

-- Guardavidas sale de la tabla de costos: el curso sigue existiendo y
-- apagado, pero su precio también era inventado y no hay nada que cobrar
-- mientras no se abra.
--
-- Solo si nadie lo ha cobrado: con un cargo encima, el precio es parte de
-- lo que explica ese cobro.
DELETE FROM "Tarifa" t
USING "TipoCurso" c
WHERE c."id" = t."tipoCursoId"
  AND c."clave" = 'SALVAVIDAS'
  AND NOT EXISTS (SELECT 1 FROM "Cargo" g WHERE g."tipoCursoId" = c."id");
