-- Recepción pasa a llamarse Capturista.
-- Se renombra el valor del enum en lugar de recrear el tipo: recrearlo
-- obligaría a borrar la columna que lo usa y con ella los usuarios.
ALTER TYPE "Rol" RENAME VALUE 'RECEPCION' TO 'CAPTURISTA';
