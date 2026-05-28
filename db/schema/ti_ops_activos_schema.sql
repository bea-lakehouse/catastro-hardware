--
-- PostgreSQL database dump
--

\restrict Rt13fJVKInnw97YuPApCR4pUcdz1joxFlewFijOVZE01GD5MPJtwYfjaNV0tgaR

-- Dumped from database version 15.15 (Homebrew)
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: activos; Type: SCHEMA; Schema: -; Owner: bea
--

CREATE SCHEMA activos;


ALTER SCHEMA activos OWNER TO bea;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: compras_mensual; Type: TABLE; Schema: activos; Owner: bea
--

CREATE TABLE activos.compras_mensual (
    anio integer NOT NULL,
    mes_num integer NOT NULL,
    mes text NOT NULL,
    cantidad_total_equipos integer NOT NULL,
    gasto_mac numeric DEFAULT 0 NOT NULL,
    gasto_windows numeric DEFAULT 0 NOT NULL,
    gasto_mac_con_iva numeric DEFAULT 0 NOT NULL,
    gasto_win_con_iva numeric DEFAULT 0 NOT NULL
);


ALTER TABLE activos.compras_mensual OWNER TO bea;

--
-- Name: equipos; Type: TABLE; Schema: activos; Owner: bea
--

CREATE TABLE activos.equipos (
    id integer NOT NULL,
    asset_tag text,
    serie text,
    tipo_equipo text NOT NULL,
    marca text,
    modelo text,
    cpu text,
    ram_gb integer,
    almacenamiento text,
    estado text DEFAULT 'vigente'::text NOT NULL,
    fecha_compra date,
    fecha_baja date,
    costo_compra numeric(12,2),
    moneda text DEFAULT 'USD'::text,
    cliente_actual text,
    persona_actual text,
    pais_actual text,
    ciudad_actual text,
    perfil_actual text,
    fuente_registro text,
    creado_en timestamp without time zone DEFAULT now(),
    actualizado_en timestamp without time zone DEFAULT now(),
    sku integer,
    nro_serie text
);


ALTER TABLE activos.equipos OWNER TO bea;

--
-- Name: equipos_id_seq; Type: SEQUENCE; Schema: activos; Owner: bea
--

CREATE SEQUENCE activos.equipos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE activos.equipos_id_seq OWNER TO bea;

--
-- Name: equipos_id_seq; Type: SEQUENCE OWNED BY; Schema: activos; Owner: bea
--

ALTER SEQUENCE activos.equipos_id_seq OWNED BY activos.equipos.id;


--
-- Name: equipos_sin_sku_backup; Type: TABLE; Schema: activos; Owner: bea
--

CREATE TABLE activos.equipos_sin_sku_backup (
    id integer,
    asset_tag text,
    serie text,
    tipo_equipo text,
    marca text,
    modelo text,
    cpu text,
    ram_gb integer,
    almacenamiento text,
    estado text,
    fecha_compra date,
    fecha_baja date,
    costo_compra numeric(12,2),
    moneda text,
    cliente_actual text,
    persona_actual text,
    pais_actual text,
    ciudad_actual text,
    perfil_actual text,
    fuente_registro text,
    creado_en timestamp without time zone,
    actualizado_en timestamp without time zone,
    sku integer,
    nro_serie text
);


ALTER TABLE activos.equipos_sin_sku_backup OWNER TO bea;

--
-- Name: historia_hw; Type: TABLE; Schema: activos; Owner: bea
--

CREATE TABLE activos.historia_hw (
    id integer NOT NULL,
    sku integer NOT NULL,
    nro_serie text,
    asset_tag text,
    tipo_evento text NOT NULL,
    fecha_evento date NOT NULL,
    cliente text,
    ciudad text,
    persona text,
    rut text,
    pais text,
    detalle text
);


ALTER TABLE activos.historia_hw OWNER TO bea;

--
-- Name: historia_hw_id_seq; Type: SEQUENCE; Schema: activos; Owner: bea
--

CREATE SEQUENCE activos.historia_hw_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE activos.historia_hw_id_seq OWNER TO bea;

--
-- Name: historia_hw_id_seq; Type: SEQUENCE OWNED BY; Schema: activos; Owner: bea
--

ALTER SEQUENCE activos.historia_hw_id_seq OWNED BY activos.historia_hw.id;


--
-- Name: vw_compras_anual_mtr; Type: VIEW; Schema: activos; Owner: bea
--

CREATE VIEW activos.vw_compras_anual_mtr AS
 SELECT compras_mensual.anio,
    sum(compras_mensual.cantidad_total_equipos) AS cantidad_total_equipos,
    sum(compras_mensual.gasto_mac) AS gasto_mac,
    sum(compras_mensual.gasto_windows) AS gasto_windows,
    sum(compras_mensual.gasto_mac_con_iva) AS gasto_mac_con_iva,
    sum(compras_mensual.gasto_win_con_iva) AS gasto_win_con_iva
   FROM activos.compras_mensual
  GROUP BY compras_mensual.anio
  ORDER BY compras_mensual.anio;


ALTER VIEW activos.vw_compras_anual_mtr OWNER TO bea;

--
-- Name: vw_compras_mensual_generica; Type: VIEW; Schema: activos; Owner: bea
--

CREATE VIEW activos.vw_compras_mensual_generica AS
 SELECT c.anio,
    c.mes_num,
    to_char((to_date(c.mes, 'Month YYYY'::text))::timestamp with time zone, 'TMMonth'::text) AS mes_display,
    c.cantidad_total_equipos,
    c.gasto_mac,
    c.gasto_windows,
    c.gasto_mac_con_iva,
    c.gasto_win_con_iva
   FROM activos.compras_mensual c
  ORDER BY c.anio, c.mes_num;


ALTER VIEW activos.vw_compras_mensual_generica OWNER TO bea;

--
-- Name: equipos id; Type: DEFAULT; Schema: activos; Owner: bea
--

ALTER TABLE ONLY activos.equipos ALTER COLUMN id SET DEFAULT nextval('activos.equipos_id_seq'::regclass);


--
-- Name: historia_hw id; Type: DEFAULT; Schema: activos; Owner: bea
--

ALTER TABLE ONLY activos.historia_hw ALTER COLUMN id SET DEFAULT nextval('activos.historia_hw_id_seq'::regclass);


--
-- Name: equipos equipos_asset_tag_key; Type: CONSTRAINT; Schema: activos; Owner: bea
--

ALTER TABLE ONLY activos.equipos
    ADD CONSTRAINT equipos_asset_tag_key UNIQUE (asset_tag);


--
-- Name: equipos equipos_pkey; Type: CONSTRAINT; Schema: activos; Owner: bea
--

ALTER TABLE ONLY activos.equipos
    ADD CONSTRAINT equipos_pkey PRIMARY KEY (id);


--
-- Name: equipos equipos_sku_nro_serie_uk; Type: CONSTRAINT; Schema: activos; Owner: bea
--

ALTER TABLE ONLY activos.equipos
    ADD CONSTRAINT equipos_sku_nro_serie_uk UNIQUE (sku, nro_serie);


--
-- Name: historia_hw historia_hw_pkey; Type: CONSTRAINT; Schema: activos; Owner: bea
--

ALTER TABLE ONLY activos.historia_hw
    ADD CONSTRAINT historia_hw_pkey PRIMARY KEY (id);


--
-- Name: equipos_cliente_idx; Type: INDEX; Schema: activos; Owner: bea
--

CREATE INDEX equipos_cliente_idx ON activos.equipos USING btree (cliente_actual);


--
-- Name: equipos_estado_idx; Type: INDEX; Schema: activos; Owner: bea
--

CREATE INDEX equipos_estado_idx ON activos.equipos USING btree (estado);


--
-- Name: equipos_fecha_compra_idx; Type: INDEX; Schema: activos; Owner: bea
--

CREATE INDEX equipos_fecha_compra_idx ON activos.equipos USING btree (fecha_compra);


--
-- Name: equipos_sku_idx; Type: INDEX; Schema: activos; Owner: bea
--

CREATE INDEX equipos_sku_idx ON activos.equipos USING btree (sku);


--
-- PostgreSQL database dump complete
--

\unrestrict Rt13fJVKInnw97YuPApCR4pUcdz1joxFlewFijOVZE01GD5MPJtwYfjaNV0tgaR

