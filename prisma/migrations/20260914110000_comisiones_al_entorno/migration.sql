-- Las comisiones de la pasarela se van al entorno.
--
-- No son configuración de la escuela: son lo que cobra Stripe, y cambian
-- según el año y según el contrato de la delegación. Quien las mueve es
-- quien despliega, con el contrato en la mano, no quien captura alumnos.
--
-- Se van con la tabla las cinco filas. Los valores de lista quedan en el
-- código y se pueden pisar con COMISION_<METODO>_PORCENTAJE y
-- COMISION_<METODO>_FIJA; ver .env.example.
DROP TABLE IF EXISTS "ConfigComision";
