// Marca scripts da §1.4 do roadmap cuja implementação pertence a uma tarefa futura.
const [task = 'uma tarefa futura', what = 'Este script'] = process.argv.slice(2);

console.error(`${what} ainda não existe: será entregue em ${task} (ver MVP-ROADMAP.md).`);
process.exit(1);
