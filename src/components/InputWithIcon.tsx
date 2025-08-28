import React, { ChangeEvent, ReactNode } from 'react';
import { Input, InputGroup, InputGroupProps, InputProps } from '@chakra-ui/react';
import { InputLeftElement } from '@chakra-ui/input';
import { SearchIcon } from '@chakra-ui/icons';

type InputWithIconProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  children?: ReactNode;
  inputProps?: Omit<InputProps, 'onChange' | 'value' | 'placeholder'>;
} & Omit<InputGroupProps, 'children' | 'onChange'>;

export const InputWithIcon = ({
  value,
  onChange,
  placeholder = 'Search...',
  children,
  inputProps = {},
  ...props
}: InputWithIconProps) => {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <InputGroup {...props}>
      <InputLeftElement pointerEvents="none">
        {React.Children.count(children) > 0 ? React.Children.only(children) : <SearchIcon color="gray.300" />}
      </InputLeftElement>
      <Input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        variant="outline"
        {...inputProps}
      />
    </InputGroup>
  );
};
