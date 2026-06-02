<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RecipeType extends Model
{
    protected $table = 'recipe_types';
    protected $primaryKey = 'recipe_type_id';
    protected $fillable = ['name', 'description'];
}
