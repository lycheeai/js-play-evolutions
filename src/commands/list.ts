import {Command, flags} from '@oclif/command'
import { calculateSchemaTable } from '../lib/files'
import { EvolutionsClient  } from '../lib/run'

export default class List extends Command {
  static description = 'describe the command here'

  static examples = [
    `$ evolutions list my_app ./evolutions/my_app`,
  ]

  static flags = {
    help: flags.help({char: 'h'}),
    schema: flags.string({char: 's', description: 'schema for evolutions table. default public.', default: 'public'}),
    table: flags.string({char: 't', description: 'evolutions table name. defaults to file folder.'}),
  }

  static args = [
    {
      name: 'files',
      required: true,
      description: 'evolutions files',
    },
    {
      name: 'db',
      required: true,
      description: 'database connection string',
    }
  ]

  async run() {
    const { flags, args } = this.parse(List);
    // From my understanding this is the best way to pass this in
    process.env.DATABASE_URL = args.db;

    const { defaultedSchema, defaultedTable } = calculateSchemaTable(args.files, flags.schema, flags.table);

    const client = new EvolutionsClient()
    try {
        this.log(`Running evolutions on ${defaultedSchema}.${defaultedTable} using ${args.files}`);
        const evos = await client.getTable(defaultedSchema, defaultedTable);

        const fixedEvos = evos.map((item) => ({
           ...item,
           apply_script: item.apply_script?.slice(0, 100) + '...',
           revert_script: item.revert_script?.slice(0, 100) + '...',
        }))

        if(fixedEvos.length) {
          console.table(fixedEvos);
        } else {
          console.warn('No evolutions have been run')
        }
    } finally {
        client.close();
    }

    // const name = flags.name ?? 'world'
    // this.log(`hello ${name} from ./src/commands/hello.ts`)
    // if (args.file && flags.force) {
    //   this.log(`you input --force and --file: ${args.file}`)
    // }
  }
}
