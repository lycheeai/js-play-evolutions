# js-play-evolutions

Javascript port of [Play Evolutions](https://www.playframework.com/documentation/2.8.x/Evolutions)

## Command line

### Up
```
evolutions up <dir> <db_string>
```

Will run up Evolutions on a particular directory. The directory structure should be the same as in Play Framework.

Ex:
```
evolutions/my_app
evolutions/my_app/1.sql
evolutions/my_app/2.sql
evolutions/my_app/3.sql
...
```

### Down

Will ready from the database to run down evolutions to revert to <id>. Note: this doesn't look at the downs in your file at all. 

```
evolutions down <dir> <db_string> <id>
```

### List/Details

`list` and `details` are debug commands to help you understand the state of your db. 

```
evolutions list <dir> <db_string>
```

```
evolutions details <dir> <db_string> <id>
```


## Library

js-play-evolutions can also be run as a library. This is useful if you want to use it in automated tests.

```typescript
import { EvolutionsClient } from 'js-play-evolutions';

const client = new EvolutionsClient(); // you can provide true to use Hasura style evolutions

try {
  //... do stuff with client
} finally {
  client.close();
}
```

### Examples

```typescript
await client.runEvolutionsUp(
  'schema',
  'evolutions_table_name',
  'evolutions/file/directory'
);

await client.runEvolutionsDown(
  'schema',
  'evolutions_table_name',
  1 // id
);
```
