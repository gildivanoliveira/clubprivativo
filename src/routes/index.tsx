import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { BarChart3, Megaphone, Database, ArrowRight, Mail, Phone, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// ==========================================================
// CONFIGURACAO RAPIDA DO SITE
// Quando trocar de bot/campanha, normalmente voce so mexe aqui.
// ==========================================================

// 1) Link do bot que vai receber os leads do anuncio.
// Troque somente o username depois de https://t.me/
// Exemplo: https://t.me/Clarinhapvt_bot
const TELEGRAM_BOT_URL = "https://t.me/Clarinhapvt_bot";

// 2) ID do bot dentro do seu painel.
// No painel, cada bot tem um ID. Clarinha = 6.
// Se criar outro bot, troque este numero para o ID do bot novo.
const BOT_ID = 6;

// 3) Pixel do Meta Ads.
// Cole aqui somente o ID numerico do Pixel do Meta.
// Exemplo: no codigo do Meta aparece fbq('init', '1311898797771813');
// Nesse caso, cole apenas: 1311898797771813
const META_PIXEL_ID = "1311898797771813";

// 4) API de tracking da sua VPS. Normalmente nao precisa mexer.
const TRACK_LEAD_URL = "https://api.clubeprivativo.com.br/api/track-lead";

// 5) Tempo antes de mandar para o Telegram.
// 1200 = 1.2 segundos. Nao recomendo colocar 0.
const REDIRECT_DELAY_MS = 1500;

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: (...args: unknown[]) => void;
  }
}

function createLeadId() {
  const leadId = `ld_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return leadId;
}

function getCookie(name: string) {
  const safe = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${safe}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

function buildFbc(fbclid: string) {
  if (!fbclid) return "";
  return `fb.1.${Date.now()}.${fbclid}`;
}

function buildTelegramUrl(leadId: string) {
  const startPayload = `trk_${leadId}`;
  return `${TELEGRAM_BOT_URL}?start=${encodeURIComponent(startPayload)}`;
}

function isMobileOrTablet() {
  const ua = navigator.userAgent || navigator.vendor || "";
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(ua);
}

function loadMetaPixel(pixelId: string) {
  if (!pixelId || window.fbq) return;

  const fbq = (...args: unknown[]) => {
    fbq.queue.push(args);
  };

  fbq.queue = [] as unknown[];
  fbq.loaded = true;
  fbq.version = "2.0";

  window.fbq = fbq as unknown as (...args: unknown[]) => void;
  window._fbq = window.fbq;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  const firstScript = document.getElementsByTagName("script")[0];
  firstScript.parentNode?.insertBefore(script, firstScript);

  window.fbq("init", pixelId);
}

function trackMetaEvent(eventName: string, payload: Record<string, unknown>, eventId: string) {
  if (typeof window.fbq !== "function") return;
  window.fbq("track", eventName, payload, { eventID: eventId });
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Clube Privativo - Solucoes Digitais e Consultoria de Dados" },
      {
        name: "description",
        content:
          "Clube Privativo: consultoria estrategica em dados, analytics e marketing digital para empresas que buscam crescimento real.",
      },
      { property: "og:title", content: "Clube Privativo - Solucoes Digitais e Consultoria de Dados" },
      {
        property: "og:description",
        content: "Consultoria em dados, analytics e marketing digital.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const CTA_URL = `${TELEGRAM_BOT_URL}?start=contato`;

  useEffect(() => {
    const leadId = createLeadId();
    loadMetaPixel(META_PIXEL_ID);
    const params = new URLSearchParams(window.location.search);
    const fbclid = params.get("fbclid") || "";
    const fbc = getCookie("_fbc") || buildFbc(fbclid);
    const fbp = getCookie("_fbp") || "";
    const tracking = {
      leadId,
      fbclid,
      fbc,
      fbp,
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
      utm_content: params.get("utm_content") || "",
      utm_term: params.get("utm_term") || "",
      event_source_url: window.location.href,
      ts: Date.now(),
    };

    trackMetaEvent(
      "PageView",
      {
        lead_id: leadId,
        source: tracking.utm_source || "direct",
        campaign: tracking.utm_campaign || "",
      },
      `pv_${leadId}`,
    );

    if (!isMobileOrTablet()) {
      return;
    }

    window.localStorage.setItem("last_lead_id", leadId);
    window.localStorage.setItem("lead_tracking", JSON.stringify(tracking));

    const postLeadPromise = fetch(TRACK_LEAD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bot_id: BOT_ID,
        lead_id: tracking.leadId,
        fbclid: tracking.fbclid,
        fbc: tracking.fbc,
        fbp: tracking.fbp,
        utm_source: tracking.utm_source,
        utm_medium: tracking.utm_medium,
        utm_campaign: tracking.utm_campaign,
        utm_content: tracking.utm_content,
        utm_term: tracking.utm_term,
        event_source_url: tracking.event_source_url,
      }),
      keepalive: true,
    }).catch(() => null);

    const postLeadWithTimeout = Promise.race([
      postLeadPromise,
      new Promise((resolve) => setTimeout(resolve, 700)),
    ]);

    trackMetaEvent(
      "Lead",
      {
        lead_id: leadId,
        destination: "telegram",
        source: tracking.utm_source || "direct",
        campaign: tracking.utm_campaign || "",
        content: tracking.utm_content || "",
      },
      leadId,
    );

    const redirectUrl = buildTelegramUrl(leadId);
    let cancelled = false;

    const redirectAfterTracking = async () => {
      await Promise.all([
        postLeadWithTimeout,
        new Promise((resolve) => setTimeout(resolve, REDIRECT_DELAY_MS)),
      ]);

      if (!cancelled) {
        window.location.replace(redirectUrl);
      }
    };

    void redirectAfterTracking();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="#top" className="text-lg font-semibold tracking-tight text-primary">
            Clube<span className="text-primary-glow">Privativo</span>
          </a>
          <nav className="hidden gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#sobre" className="transition hover:text-primary">Sobre</a>
            <a href="#servicos" className="transition hover:text-primary">Servicos</a>
            <a href="#contato" className="transition hover:text-primary">Contato</a>
          </nav>
          <Button asChild size="sm" variant="outline" className="hidden md:inline-flex">
            <a href={CTA_URL}>Acessar</a>
          </Button>
        </div>
      </header>

      <section id="top" className="relative overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
        <div className="mx-auto max-w-5xl px-6 py-28 text-center md:py-36">
          <span className="inline-block rounded-full border border-white/20 bg-white/5 px-4 py-1 text-xs font-medium uppercase tracking-widest text-white/80">
            Acesso Exclusivo
          </span>
          <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-white md:text-6xl">
            Validando seu acesso ao<br className="hidden md:block" /> Clube Privativo...
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/75">
            Voce esta sendo redirecionado para a nossa plataforma oficial em instantes.
            Prepare-se para o conteudo exclusivo.
          </p>

          <div className="mt-10 flex justify-center">
            <div className="flex items-center gap-3 rounded-full bg-white/10 px-8 py-4 text-base font-semibold text-white backdrop-blur">
              Carregando conteudo...
            </div>
          </div>
        </div>
      </section>

      <section id="sobre" className="mx-auto max-w-5xl px-6 py-24">
        <div className="grid gap-12 md:grid-cols-2 md:items-center">
          <div>
            <span className="text-sm font-semibold uppercase tracking-widest text-primary-glow">Sobre Nos</span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Especialistas em transformar dados em decisoes</h2>
          </div>
          <p className="text-lg leading-relaxed text-muted-foreground">
            O <strong className="text-foreground">Clube Privativo</strong> nasceu para entregar
            consultoria de alto nivel em dados e marketing digital. Unimos tecnologia, estrategia e
            analise para que sua empresa tome decisoes baseadas em evidencias.
          </p>
        </div>
      </section>

      <section id="servicos" className="bg-secondary/50 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-primary-glow">Servicos</span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">O que entregamos</h2>
            <p className="mt-4 text-muted-foreground">Solucoes sob medida para empresas orientadas a dados.</p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: BarChart3,
                title: "Analise de Dados",
                desc: "Dashboards, KPIs e insights acionaveis para clarear sua operacao.",
              },
              {
                icon: Megaphone,
                title: "Marketing Digital",
                desc: "Campanhas performaticas com tracking, atribuicao e ROI mensuravel.",
              },
              {
                icon: Database,
                title: "Consultoria de Dados",
                desc: "Arquitetura, governanca e cultura data-driven do zero ao avancado.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="group rounded-2xl border border-border bg-card p-8 transition hover:-translate-y-1 hover:border-primary/30 hover:shadow-[var(--shadow-elegant)]"
              >
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 text-center">
            <a
              href={CTA_URL}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary-glow"
            >
              Falar com Consultor <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      <footer id="contato" className="border-t border-border bg-primary text-primary-foreground">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Vamos conversar</h2>
            <p className="mt-4 max-w-md text-primary-foreground/70">Conte-nos sobre seu desafio. Respondemos em ate 24h uteis.</p>
            <ul className="mt-8 space-y-4 text-sm text-primary-foreground/80">
              <li className="flex items-center gap-3"><Mail className="h-4 w-4" /><span>contato@clubeprivativo.com</span></li>
              <li className="flex items-center gap-3"><Phone className="h-4 w-4" /><span>+55 (11) 98844-6600</span></li>
              <li className="flex items-center gap-3"><MapPin className="h-4 w-4" /><span>Sao Paulo, Brasil</span></li>
            </ul>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              window.location.href = CTA_URL;
            }}
            className="space-y-4 rounded-2xl bg-white/5 p-6 backdrop-blur"
          >
            <Input
              required
              placeholder="Seu nome"
              className="border-white/20 bg-white/10 text-white placeholder:text-white/50"
            />
            <Input
              required
              type="email"
              placeholder="E-mail"
              className="border-white/20 bg-white/10 text-white placeholder:text-white/50"
            />
            <Textarea
              required
              placeholder="Como podemos ajudar?"
              rows={4}
              className="border-white/20 bg-white/10 text-white placeholder:text-white/50"
            />
            <Button
              type="submit"
              className="w-full bg-white text-primary hover:bg-white/90"
            >
              Enviar mensagem
            </Button>
          </form>
        </div>
        <div className="border-t border-white/10 py-6 text-center text-xs text-primary-foreground/60">
          (c) {new Date().getFullYear()} Clube Privativo. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}
