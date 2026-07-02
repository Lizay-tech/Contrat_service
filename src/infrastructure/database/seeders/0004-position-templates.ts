import { QueryTypes, type QueryInterface } from 'sequelize';
import { sequelize } from '../sequelize';
import { env } from '../../../shared/config/env';
import { resolveVariables } from '../../../domain/template/variable-catalogue';

/**
 * Modeles de contrat PAR POSTE (PREDEFINED, clonables). Structure commune
 * dynamique (variables {{...}}) + sections specifiques au poste (mission,
 * responsabilites, articles) fournies par la specification.
 */
interface Position {
  name: string;
  mission: string;
  responsibilities: string[];
  articles: string[];
}

const BASE_ARTICLES = [
  'Respect du reglement interieur de l etablissement',
  'Respect des horaires de travail convenus',
  'Confidentialite et non-divulgation des informations',
  'Protection des donnees personnelles (eleves, personnel, familles)',
  'Usage professionnel des ressources informatiques et de la plateforme EDUCA',
  'Respect de la hierarchie et des procedures internes',
  'Participation aux formations obligatoires',
  'Respect du code d ethique de l etablissement',
];

const POSITIONS: Position[] = [
  {
    name: 'Administrateur administratif',
    mission:
      'Assurer la gestion administrative de l etablissement, la coordination des operations et la supervision des procedures.',
    responsibilities: [
      'Gestion administrative et documentaire',
      'Tenue des dossiers eleves et personnel',
      'Redaction et suivi des rapports',
      'Coordination des operations quotidiennes',
      'Utilisation des outils et modules EDUCA',
      'Application des procedures internes',
    ],
    articles: [...BASE_ARTICLES, 'Respect des procedures administratives', 'Collaboration avec les autres services', 'Securite informatique'],
  },
  {
    name: 'Responsable pedagogique',
    mission: 'Piloter la qualite pedagogique de l etablissement.',
    responsibilities: [
      'Encadrement et accompagnement des enseignants',
      'Validation des plans de cours et des contenus',
      'Supervision des evaluations',
      'Gestion et suivi des programmes',
      'Formation continue des equipes',
      'Analyse des resultats et innovation pedagogique',
    ],
    articles: [
      ...BASE_ARTICLES,
      'Respect du calendrier scolaire',
      'Validation des contenus pedagogiques',
      'Garantie de la qualite de l enseignement',
      'Supervision et impartialite des evaluations',
      'Confidentialite des resultats',
      'Accompagnement lors des inspections',
    ],
  },
  {
    name: 'Bibliothecaire',
    mission: 'Assurer la gestion de la bibliotheque physique et numerique.',
    responsibilities: [
      'Gestion des livres, emprunts et retours',
      'Classement et inventaire des ouvrages',
      'Gestion des ressources numeriques',
      'Assistance aux lecteurs',
      'Animation culturelle',
    ],
    articles: [
      ...BASE_ARTICLES,
      'Protection et preservation des ouvrages',
      'Gestion rigoureuse des prets',
      'Respect des delais d inventaire',
      'Preservation des archives',
      'Confidentialite des lecteurs',
    ],
  },
  {
    name: 'Responsable disciplinaire',
    mission: 'Garantir la discipline et un environnement scolaire sain et securitaire.',
    responsibilities: [
      'Gestion des incidents et des sanctions',
      'Prevention et mediation',
      'Accompagnement des eleves',
      'Communication avec les parents',
      'Redaction des rapports disciplinaires',
    ],
    articles: [
      ...BASE_ARTICLES,
      'Neutralite et equite',
      'Respect des droits des eleves',
      'Confidentialite des dossiers disciplinaires',
      'Respect de la procedure disciplinaire',
      'Protection et securite des eleves',
    ],
  },
  {
    name: 'Enseignant',
    mission: 'Dispenser un enseignement de qualite conforme au programme officiel.',
    responsibilities: [
      'Preparer et dispenser les cours',
      'Concevoir et corriger les evaluations',
      'Saisir les notes dans la plateforme EDUCA',
      'Assurer le suivi pedagogique des eleves',
      'Participer aux reunions et conseils',
      'Accompagner les eleves en difficulte',
    ],
    articles: [
      ...BASE_ARTICLES,
      'Respect du programme officiel',
      'Preparation obligatoire des cours',
      'Presence aux reunions pedagogiques',
      'Evaluation impartiale des eleves',
      'Deontologie enseignante',
      'Usage de la plateforme EDUCA pour le suivi',
    ],
  },
];

function li(items: string[]): string {
  return `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
}

/** Construit le corps HTML restreint d'un modele par poste. */
function buildBody(p: Position): string {
  return `<h1>Contrat de travail - ${p.name}</h1>
<h3>1. Informations generales</h3>
<p>Entre <strong>{{school_name}}</strong>, sise a {{school_address}} ({{city}}), representee par {{director_name}} ({{director_function}}), ci-apres l'employeur,</p>
<p>Et <strong>{{employee_name}}</strong>, demeurant a {{employee_address}}, piece d'identite {{employee_id_number}}, matricule {{employee_matricule}}, ci-apres l'employe(e), engage(e) au poste de {{employee_function}} pour l'annee scolaire {{academic_year}}.</p>
<h3>2. Description du poste</h3>
<p><strong>Mission :</strong> ${p.mission}</p>
<h3>3. Missions et responsabilites</h3>
${li(p.responsibilities)}
<h3>4. Conditions de travail</h3>
<p>Prise de fonction le {{start_date}}${''}. Duree de travail : {{work_hours}}. Periode d'essai : {{trial_period}}. Preavis : {{notice_period}}. Lien hierarchique : {{hierarchical_link}}.</p>
<h3>5. Remuneration et avantages</h3>
<p>Remuneration : {{salary}} {{currency}} ({{salary_in_words}}), payable {{payment_frequency}}. Avantages et primes : {{benefits}}.</p>
<h3>6. Obligations de l'employe et de l'employeur</h3>
<p>L'employe(e) s'engage a exercer ses fonctions avec diligence et loyaute ; l'employeur s'engage a fournir les moyens necessaires et a respecter les termes du present contrat.</p>
<h3>7. Reglement interieur et articles</h3>
${li(p.articles)}
<h3>8. Confidentialite et protection des donnees</h3>
<p>L'employe(e) est tenu(e) a une stricte confidentialite et au respect de la reglementation sur la protection des donnees personnelles.</p>
<h3>9. Usage des equipements et de la plateforme EDUCA</h3>
<p>Les equipements et acces EDUCA sont fournis a des fins strictement professionnelles.</p>
<h3>10. Code d'ethique</h3>
<p>L'employe(e) adhere au code d'ethique et aux valeurs de l'etablissement.</p>
<h3>11. Formation</h3>
<p>L'employe(e) participe aux formations organisees par l'etablissement.</p>
<h3>12. Evaluation</h3>
<p>Les performances sont evaluees periodiquement selon les procedures internes.</p>
<h3>13. Conges et absences</h3>
<p>Les conges et absences sont regis par le reglement interieur et la legislation applicable.</p>
<h3>14. Mesures disciplinaires</h3>
<p>Tout manquement peut entrainer des mesures disciplinaires proportionnees.</p>
<h3>15. Modification, suspension et resiliation</h3>
<p>Le present contrat peut etre modifie, suspendu ou resilie dans les conditions prevues par la loi et le reglement interieur.</p>
<h3>16. Dispositions finales</h3>
<p>Fait a {{city}}, le {{today}}.</p>
<h3>17. Signatures</h3>
<p>Employe(e) : {{employee_name}} {{signature_zone}}</p>
<p>Superieur immediat / RH {{signature_zone}}</p>
<p>Directeur : {{director_name}} {{signature_zone}}</p>
<p>Cachet officiel de l'etablissement</p>`;
}

export async function up(_ctx: { context: QueryInterface }): Promise<void> {
  const systemTenant = env.educaSystemTenantId;

  await sequelize.transaction(async (transaction) => {
    await sequelize.query('SET LOCAL app.tenant_school_id = :tenant', {
      replacements: { tenant: systemTenant },
      transaction,
    });

    for (const p of POSITIONS) {
      const body = buildBody(p);
      const name = `Modele de contrat - ${p.name}`;
      await sequelize.query(
        `
        WITH new_tpl AS (
          INSERT INTO contract_templates
            (id, tenant_school_id, scope_owner, contract_type_id, name, description,
             status, current_version, created_by, created_at, updated_at)
          SELECT gen_random_uuid(), :tenant, 'PREDEFINED',
                 (SELECT id FROM contract_types WHERE code = 'PERSONNEL_CDI'),
                 :name, :description, 'PUBLISHED', 1, NULL, now(), now()
          WHERE NOT EXISTS (
            SELECT 1 FROM contract_templates WHERE name = :name AND scope_owner = 'PREDEFINED'
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
            name,
            description: `Modele de contrat par poste : ${p.name}.`,
            body,
            variables: JSON.stringify(resolveVariables(body)),
          },
          type: QueryTypes.INSERT,
          transaction,
        },
      );
    }
  });
}

export async function down(_ctx: { context: QueryInterface }): Promise<void> {
  const names = POSITIONS.map((p) => `Modele de contrat - ${p.name}`);
  await sequelize.query(
    `DELETE FROM contract_templates WHERE scope_owner = 'PREDEFINED' AND name IN (:names);`,
    { replacements: { names } },
  );
}
