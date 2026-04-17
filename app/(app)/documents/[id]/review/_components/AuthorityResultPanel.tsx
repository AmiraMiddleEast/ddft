"use client";

import { CircleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ResolverResult, AuthorityRow } from "@/lib/behoerden/resolve";

type AuthorityResultPanelProps = {
  result: ResolverResult;
  onChooseAuthority: (authorityId: string) => void;
  onAdjustInputs: () => void;
  choosePending?: boolean;
};

const BREADCRUMB_SEP = " › "; // U+203A

function EmptyValue() {
  return <span className="text-muted-foreground">— nicht hinterlegt</span>;
}

/**
 * Full-width warning banner used by both the matched (needs_review) and
 * ambiguous variants per UI-SPEC Copywriting Contract.
 */
function PruefenBanner({ subtext }: { subtext: string }) {
  return (
    <div
      role="note"
      className={cn(
        "rounded-md border px-4 py-3",
        "bg-[--color-warning]/30 border-[--color-warning]",
      )}
    >
      <p className="text-sm font-semibold">Angaben bitte prüfen</p>
      <p className="mt-1 text-sm text-muted-foreground">{subtext}</p>
    </div>
  );
}

function RoutingBreadcrumb({ path }: { path: string[] }) {
  if (path.length === 0) return null;
  return (
    <p className="text-sm text-muted-foreground">{path.join(BREADCRUMB_SEP)}</p>
  );
}

function ContactBlock({ authority }: { authority: AuthorityRow }) {
  return (
    <dl className="grid gap-2 sm:grid-cols-[128px_1fr]">
      <dt className="text-sm font-semibold">Anschrift</dt>
      <dd className="text-base whitespace-pre-line">{authority.address}</dd>

      <dt className="text-sm font-semibold">Telefon</dt>
      <dd className="text-base">
        {authority.phone ? (
          <a href={`tel:${authority.phone}`} className="underline-offset-2 hover:underline">
            {authority.phone}
          </a>
        ) : (
          <EmptyValue />
        )}
      </dd>

      <dt className="text-sm font-semibold">E-Mail</dt>
      <dd className="text-base">
        {authority.email ? (
          <a
            href={`mailto:${authority.email}`}
            className="underline-offset-2 hover:underline"
          >
            {authority.email}
          </a>
        ) : (
          <EmptyValue />
        )}
      </dd>

      <dt className="text-sm font-semibold">Website</dt>
      <dd className="text-base break-all">
        {authority.website ? (
          <a
            href={authority.website}
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-2 hover:underline"
          >
            {authority.website}
          </a>
        ) : (
          <EmptyValue />
        )}
      </dd>

      <dt className="text-sm font-semibold">Öffnungszeiten</dt>
      <dd className="text-base whitespace-pre-line">
        {authority.officeHours ? authority.officeHours : <EmptyValue />}
      </dd>
    </dl>
  );
}

function MatchedVariant({
  authority,
  routing,
  specialRules,
  needsReview,
}: {
  authority: AuthorityRow;
  routing: string[];
  specialRules: string | null;
  needsReview: boolean;
}) {
  return (
    <Card className="gap-4 p-6">
      <h2 className="text-2xl font-semibold leading-tight">
        Zuständige Behörde ermittelt
      </h2>

      {needsReview ? (
        <PruefenBanner subtext="Die Quelldaten sind als prüfbedürftig markiert. Bitte vor Weiterverwendung verifizieren." />
      ) : null}

      <RoutingBreadcrumb path={routing} />

      <h3 className="text-2xl font-semibold leading-tight">{authority.name}</h3>

      <ContactBlock authority={authority} />

      {specialRules ? (
        <div className="mt-2 flex flex-col gap-2">
          <Badge variant="warning">Besonderheit</Badge>
          <p className="text-base whitespace-pre-line">{specialRules}</p>
        </div>
      ) : null}
    </Card>
  );
}

function AmbiguousVariant({
  candidates,
  routing,
  onChooseAuthority,
  choosePending,
}: {
  candidates: AuthorityRow[];
  routing: string[];
  onChooseAuthority: (id: string) => void;
  choosePending?: boolean;
}) {
  return (
    <Card className="gap-4 p-6">
      <h2 className="text-2xl font-semibold leading-tight">
        Mehrere Behörden möglich
      </h2>

      <PruefenBanner subtext="Für die Eingaben wurden mehrere zuständige Behörden gefunden. Bitte die korrekte Behörde auswählen oder die Eingaben präzisieren." />

      <RoutingBreadcrumb path={routing} />

      <div>
        <h3 className="mb-2 text-sm font-semibold">Kandidaten</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Behörde</TableHead>
              <TableHead>Routing</TableHead>
              <TableHead className="text-right">Aktion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {candidates.map((c) => {
              const candidateRoute = [c.stateId, c.regierungsbezirkId ?? "—"]
                .filter(Boolean)
                .join(BREADCRUMB_SEP);
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-semibold">{c.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {candidateRoute}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      disabled={choosePending}
                      onClick={() => onChooseAuthority(c.id)}
                    >
                      Diese Behörde übernehmen
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function NotFoundVariant({
  onAdjustInputs,
}: {
  onAdjustInputs: () => void;
}) {
  return (
    <Card className="items-center gap-3 p-6 py-8 text-center">
      <CircleAlert
        className="size-6 text-destructive"
        aria-hidden="true"
      />
      <h2 className="text-2xl font-semibold leading-tight text-destructive">
        Keine Behörde gefunden
      </h2>
      <p className="text-base">
        Keine Behörde gefunden. Bitte Eingaben prüfen.
      </p>
      <p className="text-sm text-muted-foreground">
        Prüfen Sie Dokumenttyp, Bundesland und Ausstellungsort und versuchen Sie
        es erneut.
      </p>
      <Button variant="outline" onClick={onAdjustInputs}>
        Eingaben anpassen
      </Button>
    </Card>
  );
}

export function AuthorityResultPanel({
  result,
  onChooseAuthority,
  onAdjustInputs,
  choosePending,
}: AuthorityResultPanelProps) {
  if (result.status === "matched") {
    return (
      <MatchedVariant
        authority={result.authority}
        routing={result.routing_path}
        specialRules={result.special_rules}
        needsReview={result.needs_review}
      />
    );
  }

  if (result.status === "ambiguous") {
    return (
      <AmbiguousVariant
        candidates={result.candidates}
        routing={result.routing_path}
        onChooseAuthority={onChooseAuthority}
        choosePending={choosePending}
      />
    );
  }

  return <NotFoundVariant onAdjustInputs={onAdjustInputs} />;
}
