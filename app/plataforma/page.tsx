import { Card } from "@/components/ui/Card";

export default function PlataformaInicioPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-text-base">Inicio</h1>
      <Card title="Panel de plataforma">
        <p className="text-text-secondary">
          Entidades, cola de reportes, verificaciones, roles, auditoría y métricas por
          territorio llegan en las siguientes tareas de esta fase.
        </p>
      </Card>
    </div>
  );
}
