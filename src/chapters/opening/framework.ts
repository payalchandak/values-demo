/**
 * The one place the opening chapters get PrinciplistFramework from.
 *
 * Contract used here: `{ highlight?: Value[] }`. The component on main
 * (src/components/PrinciplistFramework) has no `highlight` prop and is sized
 * in fixed rem units, so until it gains both, a local stub fills in. When it
 * does, replace the line below with:
 *
 *   export { default as PrinciplistFramework } from "../../components/PrinciplistFramework";
 */
export { default as PrinciplistFramework } from "./PrinciplistFrameworkStub";
