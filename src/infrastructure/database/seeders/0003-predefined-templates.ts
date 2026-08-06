import { QueryTypes, type QueryInterface } from 'sequelize';
import { sequelize } from '../sequelize';
import { env } from '../../../shared/config/env';
import { resolveVariables } from '../../../domain/template/variable-catalogue';

interface PredefTemplate {
  name: string;
  description: string;
  contractTypeCode: string | null;
  body: string;
}

const SIGNATURE_ZONE = `
<p>&nbsp;</p>
<table>
  <tr>
    <td>L'employeur<br/>{{director_name}}<br/>{{signature_zone}}</td>
    <td>L'employe(e)<br/>{{employee_name}}<br/>{{signature_zone}}</td>
  </tr>
</table>`;

const TEMPLATES: PredefTemplate[] = [
  {
    name: 'Contrat de travail enseignant CDI',
    description: 'Contrat de travail a duree indeterminee pour le personnel enseignant.',
    contractTypeCode: 'PERSONNEL_CDI',
    body: `<h1>Contrat de travail a duree indeterminee</h1>
<p>Entre les soussignes :</p>
<p><strong>{{school_name}}</strong>, sise a {{school_address}}, representee par {{director_name}} ({{director_function}}), ci-apres denommee l'employeur,</p>
<p>Et <strong>{{employee_name}}</strong>, demeurant a {{employee_address}}, titulaire de la piece {{employee_id_number}}, ci-apres denomme(e) l'employe(e),</p>
<h3>Article 1 - Engagement</h3>
<p>L'employe(e) est engage(e) en qualite de {{employee_function}} a compter du {{start_date}} pour l'annee scolaire {{academic_year}}.</p>
<h3>Article 2 - Periode d'essai</h3>
<p>Le present contrat est assorti d'une periode d'essai de {{trial_period}}.</p>
<h3>Article 3 - Remuneration</h3>
<p>La remuneration est fixee a {{salary}} {{currency}} ({{salary_in_words}}), payable selon une frequence {{payment_frequency}}.</p>
<h3>Article 4 - Duree du travail</h3>
<p>La duree de travail est de {{work_hours}}.</p>
<h3>Article 5 - Preavis</h3>
<p>En cas de rupture, un preavis de {{notice_period}} devra etre respecte.</p>
<p>Fait a {{city}}, le {{today}}.</p>${SIGNATURE_ZONE}`,
  },
  {
    name: 'Contrat enseignant CDD',
    description: 'Contrat a duree determinee pour le personnel enseignant.',
    contractTypeCode: 'PERSONNEL_CDD',
    body: `<h1>Contrat de travail a duree determinee</h1>
<p>Entre <strong>{{school_name}}</strong> ({{school_address}}), representee par {{director_name}}, et <strong>{{employee_name}}</strong>.</p>
<h3>Article 1 - Objet et duree</h3>
<p>L'employe(e) est engage(e) comme {{employee_function}} du {{start_date}} au {{end_date}} ({{duration}}).</p>
<h3>Article 2 - Remuneration</h3>
<p>Remuneration : {{salary}} {{currency}} ({{salary_in_words}}), {{payment_frequency}}.</p>
<h3>Article 3 - Duree du travail</h3>
<p>{{work_hours}}.</p>
<p>Fait a {{city}}, le {{today}}.</p>${SIGNATURE_ZONE}`,
  },
  {
    name: 'Contrat vacataire (horaire)',
    description: 'Contrat de vacation remunere a l\'heure.',
    contractTypeCode: 'PERSONNEL_VACATION',
    body: `<h1>Contrat de vacation</h1>
<p>Entre <strong>{{school_name}}</strong>, representee par {{director_name}}, et <strong>{{employee_name}}</strong> ({{employee_function}}).</p>
<h3>Article 1 - Mission</h3>
<p>La vacation debute le {{start_date}} et porte sur {{work_hours}}.</p>
<h3>Article 2 - Remuneration horaire</h3>
<p>Taux : {{salary}} {{currency}} ({{salary_in_words}}) par heure, paiement {{payment_frequency}}.</p>
<p>Fait a {{city}}, le {{today}}.</p>${SIGNATURE_ZONE}`,
  },
  {
    name: 'Contrat personnel administratif',
    description: 'Contrat de travail pour le personnel administratif (secretariat, comptabilite...).',
    contractTypeCode: 'PERSONNEL_CDI',
    body: `<h1>Contrat de travail - personnel administratif</h1>
<p>Entre <strong>{{school_name}}</strong> ({{school_address}}), representee par {{director_name}} ({{director_function}}), et <strong>{{employee_name}}</strong>, matricule {{employee_matricule}}.</p>
<h3>Article 1 - Fonction</h3>
<p>Engagement en qualite de {{employee_function}} a compter du {{start_date}}.</p>
<h3>Article 2 - Remuneration</h3>
<p>{{salary}} {{currency}} ({{salary_in_words}}), {{payment_frequency}}.</p>
<h3>Article 3 - Duree du travail</h3>
<p>{{work_hours}}. Periode d'essai : {{trial_period}}.</p>
<p>Fait a {{city}}, le {{today}}.</p>${SIGNATURE_ZONE}`,
  },
  {
    name: 'Contrat de prestation de service',
    description: 'Contrat de prestation pour un intervenant externe.',
    contractTypeCode: 'PERSONNEL_PRESTATION',
    body: `<h1>Contrat de prestation de service</h1>
<p>Entre <strong>{{school_name}}</strong>, representee par {{director_name}}, et <strong>{{employee_name}}</strong> ({{employee_function}}), demeurant a {{employee_address}}.</p>
<h3>Article 1 - Objet</h3>
<p>La prestation debute le {{start_date}} et se termine le {{end_date}} ({{duration}}).</p>
<h3>Article 2 - Honoraires</h3>
<p>{{salary}} {{currency}} ({{salary_in_words}}), payables {{payment_frequency}}.</p>
<p>Fait a {{city}}, le {{today}}.</p>${SIGNATURE_ZONE}`,
  },
  {
    name: 'Convention de stage',
    description: 'Convention de stage (non remunere ou gratifie).',
    contractTypeCode: 'PERSONNEL_STAGE',
    body: `<h1>Convention de stage</h1>
<p>Entre <strong>{{school_name}}</strong> ({{school_address}}), representee par {{director_name}}, et le/la stagiaire <strong>{{employee_name}}</strong>, ne(e) le {{employee_birth_date}}.</p>
<h3>Article 1 - Objet et periode</h3>
<p>Le stage en qualite de {{employee_function}} se deroule du {{start_date}} au {{end_date}} ({{duration}}).</p>
<h3>Article 2 - Gratification</h3>
<p>Gratification eventuelle : {{salary}} {{currency}} ({{salary_in_words}}).</p>
<h3>Article 3 - Duree de presence</h3>
<p>{{work_hours}}.</p>
<p>Fait a {{city}}, le {{today}}.</p>${SIGNATURE_ZONE}`,
  },
  {
    name: 'Contrat d\'abonnement SaaS ecole',
    description: 'Contrat d\'abonnement a la plateforme EDUCA pour un etablissement.',
    contractTypeCode: 'ETAB_ABONNEMENT',
    body: `<h1>Contrat d'abonnement a la plateforme EDUCA</h1>
<p>Entre <strong>EDUCA.TECH</strong>, editeur de la plateforme, et l'etablissement <strong>{{school_name}}</strong> ({{school_address}}), represente par {{director_name}} ({{director_function}}).</p>
<h3>Article 1 - Objet</h3>
<p>Abonnement SaaS numero {{contract_number}} pour l'annee scolaire {{academic_year}}, a compter du {{start_date}} jusqu'au {{end_date}}.</p>
<h3>Article 2 - Redevance</h3>
<p>Montant : {{salary}} {{currency}} ({{salary_in_words}}), facturation {{payment_frequency}}.</p>
<h3>Article 3 - Reconduction</h3>
<p>Le present contrat se renouvelle selon les modalites convenues.</p>
<p>Fait a {{city}}, le {{today}}.</p>${SIGNATURE_ZONE}`,
  },
];

export async function up(_ctx: { context: QueryInterface }): Promise<void> {
  const systemTenant = env.educaSystemTenantId;

  await sequelize.transaction(async (transaction) => {
    // Les modeles PREDEFINED appartiennent au tenant systeme (RLS WITH CHECK).
    await sequelize.query('SET LOCAL app.tenant_school_id = :tenant', {
      replacements: { tenant: systemTenant },
      transaction,
    });

    for (const tpl of TEMPLATES) {
      const variables = JSON.stringify(resolveVariables(tpl.body));
      await sequelize.query(
        `
        WITH new_tpl AS (
          INSERT INTO contract_templates
            (id, tenant_school_id, scope_owner, contract_type_id, name, description,
             status, current_version, created_by, created_at, updated_at)
          SELECT gen_random_uuid(), :tenant, 'PREDEFINED',
                 (SELECT id FROM contract_types WHERE code = :typeCode),
                 :name, :description, 'PUBLISHED', 1, NULL, now(), now()
          WHERE NOT EXISTS (
            SELECT 1 FROM contract_templates
            WHERE name = :name AND scope_owner = 'PREDEFINED'
          )
          RETURNING id
        )
        INSERT INTO template_versions
          (id, tenant_school_id, is_predefined, template_id, version, body, variables,
           changelog, published_at, created_at, updated_at)
        SELECT gen_random_uuid(), :tenant, TRUE, new_tpl.id, 1, :body, CAST(:variables AS jsonb),
               'Version initiale', now(), now(), now()
        FROM new_tpl;
        `,
        {
          replacements: {
            tenant: systemTenant,
            typeCode: tpl.contractTypeCode,
            name: tpl.name,
            description: tpl.description,
            body: tpl.body,
            variables,
          },
          type: QueryTypes.INSERT,
          transaction,
        },
      );
    }
  });
}

export async function down(_ctx: { context: QueryInterface }): Promise<void> {
  await sequelize.query(
    `DELETE FROM contract_templates WHERE scope_owner = 'PREDEFINED' AND name IN (:names);`,
    { replacements: { names: TEMPLATES.map((t) => t.name) } },
  );
}
