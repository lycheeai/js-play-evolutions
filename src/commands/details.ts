import {Command, flags} from '@oclif/command'
import { calculateSchemaTable, readSQLFile } from '../lib/files'
import { EvolutionsClient  } from '../lib/run'
import * as _ from 'lodash'

export default class Details extends Command {
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
    },
    {
      name: 'id',
      required: true,
      description: 'get details for this id',
      parse: (i: string) => parseInt(i)
    }    
  ]

  async run() {
    const { flags, args } = this.parse(Details);
    // From my understanding this is the best way to pass this in
    process.env.DATABASE_URL = args.db;

    const { defaultedSchema, defaultedTable } = calculateSchemaTable(args.files, flags.schema, flags.table);

    const client = new EvolutionsClient()
    try {
        this.log(`Running evolutions on ${defaultedSchema}.${defaultedTable} using ${args.files}`);
        const evos = await client.getTable(defaultedSchema, defaultedTable);

        const evo = _.find(evos, (e) => (e.id === args.id))

        const local = readSQLFile(args.files, `${args.id}.sql`)

        if (!evo) {
            console.warn('Evolution not found')
        } else {
            // status
            console.warn(evo.apply_script);
            console.warn(evo.revert_script);

            // matches local or not
            console.warn(evo.hash);
            console.warn(local.hash);
        }
    } finally {
        client.close();
    }
  }
}
