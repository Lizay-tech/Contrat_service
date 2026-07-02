import { getSchool } from '../../infrastructure/clients/ecole.client';
import { getEmployee } from '../../infrastructure/clients/personnel.client';
import { getUser } from '../../infrastructure/clients/user.client';
import { getActiveAcademicYear } from '../../infrastructure/clients/academic-year.client';
import { getAssignment } from '../../infrastructure/clients/affectation.client';
import {
  academicYearBlock,
  assignmentFromEmployee,
  normalizeEmployee,
  normalizeSchool,
  supervisorName,
  type ContractContext,
  type EmployeeBlock,
} from './contract-context';

export interface AggregateInput {
  employeeId?: string | null;
  schoolId?: string | null;
  assignmentId?: string | null;
  token: string | null;
}

/**
 * Assemble le ContractContext depuis les services REELLEMENT disponibles.
 * Resilient: chaque source manquante est signalee dans missingSources, jamais
 * d'exception. L'annee scolaire fournit l'en-tete X-Academic-Year-Id des appels
 * qui l'exigent (signature-service).
 */
export async function aggregateContext(input: AggregateInput): Promise<ContractContext> {
  const missing: string[] = [];
  const warnings: string[] = [];
  const token = input.token;

  // Annee scolaire (systeme-wide) + employe en parallele.
  const [year, employeeRaw] = await Promise.all([
    getActiveAcademicYear(token),
    input.employeeId ? getEmployee(input.employeeId, token) : Promise.resolve(null),
  ]);
  if (!year) missing.push('annee-scolaire');

  let employee: EmployeeBlock | undefined;
  if (employeeRaw) {
    employee = normalizeEmployee(employeeRaw);
  } else if (input.employeeId) {
    // Repli manage-account (nom/email) si le dossier personnel est absent.
    const user = await getUser(input.employeeId, token);
    if (user) {
      employee = {
        fullName: supervisorName(user),
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        phone: user.phone,
        schoolId: user.school_id,
      };
      warnings.push('Personnel non trouve dans enseignant-service; repli manage-account');
    } else {
      missing.push('personnel');
    }
  }

  // Ecole: id fourni, sinon celle de l'employe.
  const schoolId = input.schoolId ?? employee?.schoolId ?? null;
  const schoolRaw = schoolId ? await getSchool(schoolId, token) : null;
  if (schoolId && !schoolRaw) missing.push('ecole');
  const school = schoolRaw ? normalizeSchool(schoolRaw) : undefined;

  // Affectation: source dediee (optionnelle) sinon derivee du dossier personnel.
  let assignment = employeeRaw ? assignmentFromEmployee(employeeRaw) : undefined;
  const assignmentRaw = await getAssignment(
    { assignmentId: input.assignmentId, employeeId: input.employeeId },
    token,
    year?.id ?? null,
  );
  if (assignmentRaw) {
    assignment = { ...assignment, ...assignmentRaw };
  } else if (input.assignmentId) {
    missing.push('affectation');
  }

  // Lien hierarchique (nom du superviseur) via manage-account, best-effort.
  if (assignment && !assignment.hierarchicalLink && employee?.supervisorId) {
    const sup = await getUser(employee.supervisorId, token);
    if (sup) assignment.hierarchicalLink = supervisorName(sup);
  }

  return {
    school,
    employee,
    assignment,
    academicYear: year ? academicYearBlock(year) : undefined,
    missingSources: missing,
    warnings,
  };
}

/**
 * Mappe le ContractContext vers les variables du catalogue (§4). Ne produit que
 * les valeurs NON vides (pour ne jamais ecraser une saisie utilisateur par du vide).
 */
export function contextToVariables(ctx: ContractContext): Record<string, string> {
  const out: Record<string, string> = {};
  const set = (key: string, value: string | number | undefined | null) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      out[key] = String(value);
    }
  };

  const s = ctx.school;
  set('school_name', s?.schoolName);
  set('school_address', s?.schoolAddress);
  set('school_phone', s?.schoolPhone);
  set('school_email', s?.schoolEmail);
  set('school_logo', s?.schoolLogo);
  set('city', s?.city);
  set('currency', s?.currency);
  set('director_name', s?.directorName);
  set('director_function', s?.directorFunction);

  const e = ctx.employee;
  set('employee_name', e?.fullName);
  set('employee_first_name', e?.firstName);
  set('employee_last_name', e?.lastName);
  set('employee_address', e?.address);
  set('employee_phone', e?.phone);
  set('employee_email', e?.email);
  set('employee_id_number', e?.idNumber);
  set('employee_matricule', e?.matricule);
  set('employee_birth_date', e?.birthDate);
  set('employee_nationality', e?.nationality);

  const a = ctx.assignment;
  set('employee_function', a?.position ?? undefined);
  set('hierarchical_link', a?.hierarchicalLink);
  set('work_hours', a?.workHours);

  set('academic_year', ctx.academicYear?.name);

  return out;
}
