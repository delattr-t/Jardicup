import Link from "next/link";
import Image from "next/image";
import Hero from "@/components/site/Hero";
import Video from "@/components/site/Video";
import RailIcon from "@/components/configurator/RailIcon";
import { RAILS, RAIL_KEYS, VERSIONS, VERSION_KEYS } from "@/lib/config";

function Section({ id, className = "", children }: { id?: string; className?: string; children: React.ReactNode }) {
  return (
    <section id={id} className={`scroll-mt-16 py-16 md:py-24 ${className}`}>
      <div className="mx-auto max-w-[1240px] px-4">{children}</div>
    </section>
  );
}
const H2 = ({ children }: { children: React.ReactNode }) => <h2 className="text-[clamp(1.8rem,2.6vw+0.9rem,2.8rem)] font-extrabold">{children}</h2>;

export default function Home() {
  return (
    <>
      <Hero />

      {/* ---------- Montage : les trois rendus ---------- */}
      <Section id="montage">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:items-start">
          <div className="lg:sticky lg:top-24">
            <H2>Posée au sol, retenue par la grille, garnie en une après-midi.</H2>
            <p className="mt-5 max-w-[46ch] text-iron-2">
              Le réservoir se pose sur la dalle, le corps s&rsquo;emboîte étage par étage, l&rsquo;attache imprimée à vos cotes vient enserrer le garde-corps. Les plants se glissent dans les logements inclinés, et la cascade fait le reste.
            </p>
            <Link href="/configurateur" className="btn btn-primary mt-7">Voir la tour sur mon balcon</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Video src="/media/encastrement-pousse.mp4" poster="/media/poster-encastrement-pousse.jpg" label="Montage et pousse" />
            <Video src="/media/montage-360.mp4" poster="/media/poster-montage-360.jpg" label="Vue du balcon" />
            <Video src="/media/tour-360.mp4" poster="/media/poster-tour-360.jpg" label="La tour en 360°" className="col-span-2 md:col-span-1" />
          </div>
        </div>
      </Section>

      <div className="rail-rule opacity-25" aria-hidden="true" />

      {/* ---------- Fonctionnement ---------- */}
      <Section id="fonctionnement">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="relative overflow-hidden rounded-xl bg-stone-2 lg:max-h-[720px]">
            <Image src="/media/rendu-tour.jpg" alt="Rendu de la tour jardicup garnie de salades, aromatiques et thym, avec son panneau solaire" width={540} height={960} className="h-full w-full object-cover" sizes="(min-width:1024px) 40vw, 100vw" />
          </div>
          <div>
            <H2>Le trajet de l&rsquo;eau, du réservoir aux racines.</H2>
            <ol className="mt-8 grid gap-0 border-t border-iron/15">
              {[
                ["Le réservoir", "15 litres au pied de la tour. Il porte tout le poids et sert de lest."],
                ["La pompe", "Une pompe 12 V remonte l'eau par le tube central quelques minutes par heure, et seulement le jour."],
                ["La cascade", "L'eau redescend d'étage en étage et des mèches humidifient les racines en continu."],
                ["Le retour", "Le surplus revient au réservoir. Rien ne déborde chez le voisin du dessous."],
                ["La carte maison", "Elle coupe la pompe si le réservoir est vide ou la batterie faible, et dort entre deux arrosages."],
              ].map(([t, d], i) => (
                <li key={t} className="grid grid-cols-[2.6rem_1fr] gap-4 border-b border-iron/15 py-5">
                  <span className="display text-[1.8rem] font-black leading-none text-sand-3 tnum">{i + 1}</span>
                  <div>
                    <h3 className="text-[1.15rem] font-bold">{t}</h3>
                    <p className="mt-1 text-[0.95rem] text-iron-2">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Section>

      {/* ---------- Gamme ---------- */}
      <Section id="gamme" className="bg-paper">
        <div className="max-w-[760px]">
          <H2>Un seul corps, trois façons de l&rsquo;alimenter.</H2>
          <p className="mt-4 text-iron-2">La partie imprimée et le régime d&rsquo;arrosage sont identiques. Seule la baie électrique change, selon ce que votre balcon permet.</p>
        </div>
        <div className="mt-10 grid gap-3 md:grid-cols-3">
          {VERSION_KEYS.map((k, i) => {
            const v = VERSIONS[k];
            const feat = i === 2;
            return (
              <article key={k} className={`grid content-start gap-3 rounded-xl p-6 ${feat ? "bg-leaf-2 text-paper" : "border border-stone-3 bg-stone"}`}>
                <span className={`text-[0.8rem] font-semibold ${feat ? "text-leaf-3" : "text-iron-3"}`}>{v.tag}</span>
                <h3 className="text-[1.9rem] font-black">{v.name}</h3>
                <p className={feat ? "text-paper/85" : "text-iron-2"}>{v.line}</p>
                <ul className={`grid gap-1 pl-4 text-[0.92rem] marker:text-current ${feat ? "list-disc text-paper/85" : "list-disc text-iron-2"}`}>
                  {v.bullets.map((b) => <li key={b}>{b}</li>)}
                </ul>
                <p className={`mt-3 border-t pt-3 text-[0.84rem] font-semibold ${feat ? "border-paper/25" : "border-stone-3 text-iron-2"}`}>Prix communiqué à l&rsquo;ouverture des ventes</p>
              </article>
            );
          })}
        </div>
        <p className="mt-6 text-[0.92rem] text-iron-2">Vous pouvez déjà réserver la configuration qui vous convient : nous vous prévenons dès que les prix et les délais sont fixés, sans engagement.</p>
      </Section>

      {/* ---------- Attaches ---------- */}
      <Section id="attaches">
        <div className="max-w-[760px]">
          <H2>Le même corps de tour, une attache imprimée aux cotes de votre grille.</H2>
          <p className="mt-4 text-iron-2">La tour a un dos plat qui se plaque contre le garde-corps, côté intérieur. Seule l&rsquo;attache change selon votre balcon : elle reprend le diamètre de vos barreaux, l&rsquo;épaisseur de votre verre ou la taille de votre maille.</p>
        </div>
        <ul className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-5">
          {RAIL_KEYS.map((k) => (
            <li key={k}>
              <Link href={`/configurateur?rail=${k}`} className="grid h-full content-start gap-2 rounded-xl border border-stone-3 bg-paper p-5 no-underline transition-[border-color,transform] duration-150 ease-[var(--ease-out)] hover:border-leaf active:scale-[0.98]">
                <RailIcon kind={k} className="h-14 w-20 text-leaf-2" />
                <h3 className="text-[1.05rem] font-bold">{RAILS[k].name}</h3>
                <p className="text-[0.88rem] text-iron-2">{RAILS[k].att}.</p>
                <span className="mt-auto pt-2 text-[0.82rem] font-semibold text-leaf-2">Simuler ce balcon →</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 flex max-w-[820px] items-start gap-3 text-[0.95rem] text-iron-2">
          <svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0 text-leaf" aria-hidden="true"><path d="M12 3 4 6v6c0 4.4 3.4 8 8 9 4.6-1 8-4.6 8-9V6l-8-3Z" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m8.5 12 2.5 2.5 4.5-5" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
          Dans tous les cas, une sangle anti-chute indépendante est bouclée sur la lisse haute. Le montage se fait toujours côté intérieur et l&rsquo;eau ne coule jamais vers la rue.
        </p>
      </Section>

      {/* ---------- Biodiversité ---------- */}
      <Section id="nature" className="bg-iron text-stone">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <H2>Chaque balcon peut devenir un relais pour la biodiversité.</H2>
            <p className="mt-5 max-w-[52ch] text-stone-3">Une tour ne remplace pas un jardin. Mais des milliers de balcons fleuris forment un réseau de petites haltes entre les parcs, là où les insectes et les oiseaux trouvent aujourd&rsquo;hui peu de place.</p>
            <ul className="mt-8 grid gap-4">
              {[
                ["Des fleurs pour les pollinisateurs", "Bourrache, capucine : le configurateur réserve des places pour elles entre les cultures."],
                ["Aucun pesticide", "On récolte ce qu'on mange, à quelques pas de la cuisine."],
                ["Matière recyclée, pièces réparables", "Pièces imprimées en plastique recyclé, remplaçables une à une."],
              ].map(([t, d]) => (
                <li key={t} className="grid grid-cols-[1.4rem_1fr] gap-3">
                  <svg viewBox="0 0 24 24" className="mt-1 size-5 text-leaf-3" aria-hidden="true"><path d="M5 19c0-8 6-14 15-14-1 9-6 15-14 15" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M5 19 13 11" stroke="currentColor" strokeWidth="2" /></svg>
                  <div><b className="block text-stone">{t}</b><span className="text-[0.93rem] text-stone-3">{d}</span></div>
                </li>
              ))}
            </ul>
          </div>
          <dl className="grid content-start border-t-2 border-stone">
            {[
              ["87", "espèces d'abeilles recensées dans Paris intra-muros.", "https://zenodo.org/records/4390855", "Ropars et al., 2018"],
              ["−73 %", "de moineaux à Paris entre 2013 et 2016.", "https://noe.org/media/missions/guide-balcon-web.pdf", "LPO et Corif, cités par Noé"],
              ["+", "d'espèces dans les jardins reliés par des continuités vertes que dans les jardins isolés.", "https://noe.org/media/missions/guide-balcon-web.pdf", "Vergnes et al., 2012, cité par Noé"],
            ].map(([n, t, href, src]) => (
              <div key={n} className="grid grid-cols-[minmax(110px,auto)_1fr] items-baseline gap-5 border-b border-stone/20 py-5">
                <dt className="display text-[2.4rem] font-black leading-none text-leaf-3 tnum">{n}</dt>
                <dd className="text-stone-3">{t} <a href={href} target="_blank" rel="noopener" className="text-[0.82rem] text-stone-3 hover:text-stone">{src}</a></dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      {/* ---------- FAQ ---------- */}
      <Section id="questions">
        <H2>Avant de vous lancer.</H2>
        <div className="mt-8 max-w-[860px] border-t border-iron/15">
          {[
            ["Faut-il percer le garde-corps ou le mur ?", "Non. La tour se pose au sol sur son réservoir et l'attache vient seulement la retenir contre la grille. Tout se démonte sans laisser de trace, ce qui convient aux locataires et aux copropriétés."],
            ["Mon garde-corps va-t-il supporter le poids ?", "Il n'a pas à le porter. Le poids, réservoir plein compris, descend dans la dalle par la base. Le garde-corps ne reçoit qu'un effort latéral pour empêcher la tour de basculer, et la géométrie la fait toujours tomber vers l'intérieur du balcon en cas d'incident."],
            ["Est-ce autorisé en copropriété ?", "La tour se monte côté intérieur, comme l'exigent la plupart des règlements, et reste sobre vue de la rue. Vérifiez tout de même votre règlement de copropriété s'il encadre l'aspect des balcons."],
            ["Que se passe-t-il pendant les vacances ?", "En été, le réservoir tient environ une semaine selon les cultures et l'exposition ; le configurateur vous donne une estimation pour votre balcon. Si le réservoir se vide, la pompe s'arrête toute seule."],
            ["Et en hiver ?", "On vide le réservoir, on rentre la batterie chargée à moitié et on laisse la tour au repos ou on la démonte. Certaines aromatiques vivaces passent l'hiver dehors."],
            ["Quand pourrai-je commander ?", "Le prototype est en cours de montage. Réservez votre configuration dès maintenant : vous serez prévenu en premier à l'ouverture des ventes, et vous pourrez alors confirmer ou non."],
            ["Les récoltes sont-elles bio ?", "La culture hors-sol ne peut pas être certifiée bio en Europe, car le label exige une culture en pleine terre. Les plantes absorbent les mêmes éléments minéraux qu'en terre, sans pesticides sur la tour."],
          ].map(([q, a]) => (
            <details key={q} className="group border-b border-iron/15">
              <summary className="flex cursor-pointer items-center justify-between gap-4 py-4 text-[1.08rem] font-bold display">
                {q}
                <svg viewBox="0 0 20 20" className="size-5 shrink-0 text-leaf transition-transform duration-200 ease-[var(--ease-out)] group-open:rotate-45" aria-hidden="true"><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              </summary>
              <p className="max-w-[68ch] pb-5 text-iron-2">{a}</p>
            </details>
          ))}
        </div>
      </Section>

      {/* ---------- Appel final ---------- */}
      <section className="bg-sand">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-6 px-4 py-14">
          <div>
            <h2 className="text-[clamp(1.6rem,2.2vw+0.8rem,2.4rem)] font-extrabold">Votre balcon, votre grille, votre tour.</h2>
            <p className="mt-2 text-iron-2">Trois minutes pour la composer, aucune carte bancaire pour la réserver.</p>
          </div>
          <Link href="/configurateur" className="btn btn-primary !px-7 !py-4 !text-[1.05rem]">Configurer ma tour</Link>
        </div>
      </section>
    </>
  );
}
