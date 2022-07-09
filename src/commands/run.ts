import {Command, flags} from '@oclif/command'
import { calculateSchemaTable } from '../lib/files'
import { EvolutionsClient  } from '../lib/run'

export default class Run extends Command {
  static description = 'describe the command here'

  static examples = [
    `$ evolutions run my_app ./evolutions/my_app`,
  ]

  static flags = {
    help: flags.help({char: 'h'}),
    // flag with a value (-n, --name=VALUE)
    schema: flags.string({char: 's', description: 'schema for evolutions table. default public.', default: 'public'}),
    table: flags.string({char: 't', description: 'evolutions table name. defaults to file folder.'}),
    // flag with no value (-f, --force)
    files: flags.string({char: 'f', description: 'evolutions files', required: true}),
  }

  static args = [{name: 'file'}]

  async run() {
    const { flags} = this.parse(Run);
    const { defaultedSchema, defaultedTable } = calculateSchemaTable(flags.files, flags.schema, flags.table);

    const client = new EvolutionsClient()
    try {
        this.log(`Running evolutions on ${defaultedSchema}.${defaultedTable} using ${flags.files}`);
        await client.runEvolutionsUp(defaultedSchema, defaultedTable, flags.files)
        this.log('Successfully ran evolutions');
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
